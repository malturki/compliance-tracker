import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, GET } from '../route';
import { NextRequest } from 'next/server';

// Mock the database
vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
  },
}));

// Mock ulid
vi.mock('ulid', () => ({
  ulid: vi.fn(() => 'test-ulid-123'),
}));

describe('POST /api/obligations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates obligation with valid data (201)', async () => {
    const validData = {
      title: 'Annual Tax Filing',
      category: 'tax',
      frequency: 'annual',
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
      riskLevel: 'high',
    };

    const request = new NextRequest('http://localhost/api/obligations', {
      method: 'POST',
      body: JSON.stringify(validData),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    
    const data = await response.json();
    expect(data).toHaveProperty('id');
  });

  it('rejects empty title (400)', async () => {
    const invalidData = {
      title: '',
      category: 'tax',
      frequency: 'annual',
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
    };

    const request = new NextRequest('http://localhost/api/obligations', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('rejects invalid category enum (400)', async () => {
    const invalidData = {
      title: 'Test',
      category: 'invalid-category',
      frequency: 'annual',
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
    };

    const request = new NextRequest('http://localhost/api/obligations', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('rejects invalid date format (400)', async () => {
    const invalidData = {
      title: 'Test',
      category: 'tax',
      frequency: 'annual',
      nextDueDate: '12/31/2024', // Wrong format
      owner: 'John Doe',
    };

    const request = new NextRequest('http://localhost/api/obligations', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('rejects invalid frequency enum (400)', async () => {
    const invalidData = {
      title: 'Test',
      category: 'tax',
      frequency: 'daily', // Not valid
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
    };

    const request = new NextRequest('http://localhost/api/obligations', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

describe('GET /api/obligations', () => {
  it('returns empty array when no obligations exist', async () => {
    const request = new NextRequest('http://localhost/api/obligations');
    
    const response = await GET(request);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('filters by category when provided', async () => {
    const request = new NextRequest('http://localhost/api/obligations?category=tax');
    
    const response = await GET(request);
    expect(response.status).toBe(200);
  });

  it('filters by status when provided', async () => {
    const request = new NextRequest('http://localhost/api/obligations?status=overdue');
    
    const response = await GET(request);
    expect(response.status).toBe(200);
  });

  it('supports search parameter', async () => {
    const request = new NextRequest('http://localhost/api/obligations?search=tax');
    
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});
