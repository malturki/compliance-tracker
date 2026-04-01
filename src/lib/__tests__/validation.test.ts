import { describe, it, expect } from 'vitest';
import { createObligationSchema, updateObligationSchema, completeObligationSchema } from '../validation';

describe('createObligationSchema', () => {
  it('accepts valid data', () => {
    const valid = {
      title: 'Test Obligation',
      description: 'Test description',
      category: 'tax',
      frequency: 'annual',
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
      riskLevel: 'high',
    };
    
    const result = createObligationSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const invalid = {
      title: '',
      category: 'tax',
      frequency: 'annual',
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
    };
    
    const result = createObligationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid category enum', () => {
    const invalid = {
      title: 'Test',
      category: 'invalid-category',
      frequency: 'annual',
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
    };
    
    const result = createObligationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid date format', () => {
    const invalid = {
      title: 'Test',
      category: 'tax',
      frequency: 'annual',
      nextDueDate: '12/31/2024', // Wrong format
      owner: 'John Doe',
    };
    
    const result = createObligationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid frequency enum', () => {
    const invalid = {
      title: 'Test',
      category: 'tax',
      frequency: 'daily', // Not a valid frequency
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
    };
    
    const result = createObligationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('sets default values correctly', () => {
    const minimal = {
      title: 'Test',
      category: 'tax',
      frequency: 'annual',
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
    };
    
    const result = createObligationSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.riskLevel).toBe('medium');
      expect(result.data.alertDays).toEqual([]);
      expect(result.data.entity).toBe('Acme Corp');
      expect(result.data.autoRecur).toBe(false);
    }
  });

  it('accepts optional fields', () => {
    const withOptional = {
      title: 'Test',
      category: 'tax',
      frequency: 'annual',
      nextDueDate: '2024-12-31',
      owner: 'John Doe',
      description: 'Some description',
      subcategory: 'Federal',
      assignee: 'Jane Doe',
      alertDays: [7, 14, 30],
      sourceDocument: 'https://example.com/doc.pdf',
      notes: 'Important notes',
      jurisdiction: 'Illinois',
      amount: 5000,
      autoRecur: true,
      lastCompletedDate: '2023-12-31',
    };
    
    const result = createObligationSchema.safeParse(withOptional);
    expect(result.success).toBe(true);
  });
});

describe('updateObligationSchema', () => {
  it('accepts valid partial updates', () => {
    const valid = {
      title: 'Updated Title',
      riskLevel: 'critical',
    };
    
    const result = updateObligationSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid fields', () => {
    const invalid = {
      category: 'invalid-category',
    };
    
    const result = updateObligationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts empty object (no updates)', () => {
    const result = updateObligationSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects invalid date format in nextDueDate', () => {
    const invalid = {
      nextDueDate: 'invalid-date',
    };
    
    const result = updateObligationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('allows null values for nullable fields', () => {
    const valid = {
      description: null,
      assignee: null,
      notes: null,
    };
    
    const result = updateObligationSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe('completeObligationSchema', () => {
  it('accepts valid completion data', () => {
    const valid = {
      completedDate: '2024-12-31',
      completedBy: 'John Doe',
      evidenceUrl: 'https://example.com/evidence.pdf',
      notes: 'Completed successfully',
    };
    
    const result = completeObligationSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid date format', () => {
    const invalid = {
      completedDate: '12/31/2024',
      completedBy: 'John Doe',
    };
    
    const result = completeObligationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects empty completedBy', () => {
    const invalid = {
      completedDate: '2024-12-31',
      completedBy: '',
    };
    
    const result = completeObligationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts empty string for evidenceUrl', () => {
    const valid = {
      completedDate: '2024-12-31',
      completedBy: 'John Doe',
      evidenceUrl: '',
    };
    
    const result = completeObligationSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid URL format', () => {
    const invalid = {
      completedDate: '2024-12-31',
      completedBy: 'John Doe',
      evidenceUrl: 'not-a-url',
    };
    
    const result = completeObligationSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('optional fields can be omitted', () => {
    const minimal = {
      completedDate: '2024-12-31',
      completedBy: 'John Doe',
    };
    
    const result = completeObligationSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });
});
