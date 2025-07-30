import { detectPressureZones } from './orderbookUtils';

describe('detectPressureZones', () => {
  it('marks only higher-than-threshold bars as pressure', () => {
    // 10 is the only outlier
    const input = [
      { quantity: 1 }, { quantity: 2 }, { quantity: 1 }, { quantity: 10 }, { quantity: 2 }
    ];
    expect(detectPressureZones(input)).toEqual([false, false, false, true, false]);
  });

  it('returns all false for uniform quantities', () => {
    const input = Array(8).fill({ quantity: 3 });
    expect(detectPressureZones(input)).toEqual([false,false,false,false,false,false,false,false]);
  });

  it('returns empty for empty input', () => {
    expect(detectPressureZones([])).toEqual([]);
  });
});