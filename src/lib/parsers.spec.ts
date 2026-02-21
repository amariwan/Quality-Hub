import { getFiltersStateParser, getSortingStateParser } from '@/lib/parsers';

describe('getSortingStateParser', () => {
  it('parses valid sorting payloads', () => {
    const parser = getSortingStateParser(['name']);
    const value = JSON.stringify([{ id: 'name', desc: true }]);

    expect(parser.parse(value)).toEqual([{ id: 'name', desc: true }]);
  });

  it('rejects unknown column ids', () => {
    const parser = getSortingStateParser(['name']);
    const value = JSON.stringify([{ id: 'email', desc: true }]);

    expect(parser.parse(value)).toBeNull();
  });
});

describe('getFiltersStateParser', () => {
  it('parses valid filter payloads', () => {
    const parser = getFiltersStateParser(['status']);
    const value = JSON.stringify([
      {
        id: 'status',
        value: 'active',
        variant: 'select',
        operator: 'eq',
        filterId: 'f1'
      }
    ]);

    expect(parser.parse(value)).toEqual([
      {
        id: 'status',
        value: 'active',
        variant: 'select',
        operator: 'eq',
        filterId: 'f1'
      }
    ]);
  });

  it('rejects invalid filter variants', () => {
    const parser = getFiltersStateParser(['status']);
    const value = JSON.stringify([
      {
        id: 'status',
        value: 'active',
        variant: 'unsupported',
        operator: 'eq',
        filterId: 'f1'
      }
    ]);

    expect(parser.parse(value)).toBeNull();
  });
});
