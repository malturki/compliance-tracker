import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';

// Mock ulid first
vi.mock('ulid', () => ({
  ulid: vi.fn(() => 'completion-ulid-123'),
}));

// Mock the database with transaction support
vi.mock('@/db', () => {
  const mockTransaction = vi.fn();
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(),
        })),
      })),
      transaction: mockTransaction,
    },
  };
});

describe('POST /api/obligations/[id]/complete', () => {
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import('@/db');
    mockDb = dbModule.db;
  });

  it('creates completion + updates obligation atomically (200)', async () => {
    const mockObligation = {
      id: '123',
      title: 'Test Obligation',
      category: 'tax',
      frequency: 'annual',
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
      autoRecur: true,
    };

    // Mock select to return obligation
    vi.mocked(mockDb.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([mockObligation])),
      })) as any,
    } as any);

    // Mock transaction to execute the callback
    vi.mocked(mockDb.transaction).mockImplementation(async (callback: any) => {
      const txMock = {
        insert: vi.fn(() => ({
          values: vi.fn(() => Promise.resolve()),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => Promise.resolve()),
          })),
        })),
      };
      return await callback(txMock);
    });

    const completionData = {
      completedDate: '2024-12-31',
      completedBy: 'John Doe',
      evidenceUrl: 'https://example.com/evidence.pdf',
      notes: 'Completed successfully',
    };

    const request = new NextRequest('http://localhost/api/obligations/123/complete', {
      method: 'POST',
      body: JSON.stringify(completionData),
    });

    const response = await POST(request, { params: { id: '123' } });
    expect(response.status).toBe(201);
    
    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('id');
    
    // Verify transaction was called
    expect(mockDb.transaction).toHaveBeenCalled();
  });

  it('rejects invalid completion date (400)', async () => {
    const invalidData = {
      completedDate: 'invalid-date',
      completedBy: 'John Doe',
    };

    const request = new NextRequest('http://localhost/api/obligations/123/complete', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });

    const response = await POST(request, { params: { id: '123' } });
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('returns 404 for non-existent obligation', async () => {
    vi.mocked(mockDb.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })) as any,
    } as any);

    const completionData = {
      completedDate: '2024-12-31',
      completedBy: 'John Doe',
    };

    const request = new NextRequest('http://localhost/api/obligations/nonexistent/complete', {
      method: 'POST',
      body: JSON.stringify(completionData),
    });

    const response = await POST(request, { params: { id: 'nonexistent' } });
    expect(response.status).toBe(404);
  });

  it('auto-recurs correctly for late completion (Critical #2 fix)', async () => {
    const mockObligation = {
      id: '123',
      title: 'Quarterly Report',
      category: 'investor',
      frequency: 'quarterly',
      nextDueDate: '2024-09-30', // Past due
      owner: 'John Doe',
      autoRecur: true,
    };

    vi.mocked(mockDb.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([mockObligation])),
      })) as any,
    } as any);

    let capturedNextDueDate: string | undefined;
    vi.mocked(mockDb.transaction).mockImplementation(async (callback: any) => {
      const txMock = {
        insert: vi.fn(() => ({
          values: vi.fn(() => Promise.resolve()),
        })),
        update: vi.fn(() => ({
          set: vi.fn((data: any) => {
            capturedNextDueDate = data.nextDueDate;
            return { where: vi.fn(() => Promise.resolve()) };
          }),
        })),
      };
      return await callback(txMock);
    });

    const completionData = {
      completedDate: '2024-12-15', // Completed late
      completedBy: 'John Doe',
    };

    const request = new NextRequest('http://localhost/api/obligations/123/complete', {
      method: 'POST',
      body: JSON.stringify(completionData),
    });

    await POST(request, { params: { id: '123' } });

    // Should use completion date as base (not old due date) when completed late
    // 2024-12-15 + 3 months = 2025-03-15
    expect(capturedNextDueDate).toBe('2025-03-15');
  });

  it('rollback if update fails (Critical #4 fix - transaction)', async () => {
    const mockObligation = {
      id: '123',
      title: 'Test',
      category: 'tax',
      frequency: 'annual',
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
      autoRecur: false,
    };

    vi.mocked(mockDb.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([mockObligation])),
      })) as any,
    } as any);

    // Simulate transaction failure
    vi.mocked(mockDb.transaction).mockRejectedValue(new Error('Database error'));

    const completionData = {
      completedDate: '2024-12-31',
      completedBy: 'John Doe',
    };

    const request = new NextRequest('http://localhost/api/obligations/123/complete', {
      method: 'POST',
      body: JSON.stringify(completionData),
    });

    const response = await POST(request, { params: { id: '123' } });
    
    // Should return 500 error, indicating transaction rollback occurred
    expect(response.status).toBe(500);
  });

  it('does not recur for one-time obligations', async () => {
    const mockObligation = {
      id: '123',
      title: 'One-time Task',
      category: 'contract',
      frequency: 'one-time',
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
      autoRecur: true, // Even if autoRecur is true
    };

    vi.mocked(mockDb.select).mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([mockObligation])),
      })) as any,
    } as any);

    let capturedNextDueDate: string | undefined;
    vi.mocked(mockDb.transaction).mockImplementation(async (callback: any) => {
      const txMock = {
        insert: vi.fn(() => ({
          values: vi.fn(() => Promise.resolve()),
        })),
        update: vi.fn(() => ({
          set: vi.fn((data: any) => {
            capturedNextDueDate = data.nextDueDate;
            return { where: vi.fn(() => Promise.resolve()) };
          }),
        })),
      };
      return await callback(txMock);
    });

    const completionData = {
      completedDate: '2024-12-31',
      completedBy: 'John Doe',
    };

    const request = new NextRequest('http://localhost/api/obligations/123/complete', {
      method: 'POST',
      body: JSON.stringify(completionData),
    });

    await POST(request, { params: { id: '123' } });

    // Should NOT set a new nextDueDate for one-time obligations
    expect(capturedNextDueDate).toBeUndefined();
  });
});
