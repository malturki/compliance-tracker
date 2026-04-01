import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PUT, GET } from '../route';
import { NextRequest } from 'next/server';

// Mock the database
const mockUpdate = vi.fn();
const mockSelect = vi.fn();

vi.mock('@/db', () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mockUpdate,
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockSelect,
      })),
    })),
  },
}));

describe('PUT /api/obligations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue(undefined);
  });

  it('updates obligation with valid data (200)', async () => {
    const validUpdate = {
      title: 'Updated Title',
      riskLevel: 'critical',
    };

    const request = new NextRequest('http://localhost/api/obligations/123', {
      method: 'PUT',
      body: JSON.stringify(validUpdate),
    });

    const response = await PUT(request, { params: { id: '123' } });
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('success', true);
  });

  it('rejects invalid fields (400)', async () => {
    const invalidUpdate = {
      category: 'invalid-category',
    };

    const request = new NextRequest('http://localhost/api/obligations/123', {
      method: 'PUT',
      body: JSON.stringify(invalidUpdate),
    });

    const response = await PUT(request, { params: { id: '123' } });
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('accepts partial updates', async () => {
    const partialUpdate = {
      notes: 'Updated notes',
    };

    const request = new NextRequest('http://localhost/api/obligations/123', {
      method: 'PUT',
      body: JSON.stringify(partialUpdate),
    });

    const response = await PUT(request, { params: { id: '123' } });
    expect(response.status).toBe(200);
  });

  it('rejects invalid date format', async () => {
    const invalidUpdate = {
      nextDueDate: 'invalid-date',
    };

    const request = new NextRequest('http://localhost/api/obligations/123', {
      method: 'PUT',
      body: JSON.stringify(invalidUpdate),
    });

    const response = await PUT(request, { params: { id: '123' } });
    expect(response.status).toBe(400);
  });
});

describe('GET /api/obligations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 for non-existent ID', async () => {
    mockSelect.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/obligations/nonexistent');

    const response = await GET(request, { params: { id: 'nonexistent' } });
    expect(response.status).toBe(404);
    
    const data = await response.json();
    expect(data).toHaveProperty('error', 'Not found');
  });

  it('returns obligation data when found', async () => {
    const mockObligation = {
      id: '123',
      title: 'Test Obligation',
      category: 'tax',
      frequency: 'annual',
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
      status: 'current',
      riskLevel: 'medium',
      alertDays: '[]',
      entity: 'Acme Corp',
      autoRecur: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    mockSelect.mockResolvedValue([mockObligation]);

    const request = new NextRequest('http://localhost/api/obligations/123');

    const response = await GET(request, { params: { id: '123' } });
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('id', '123');
    expect(data).toHaveProperty('title', 'Test Obligation');
  });
});
