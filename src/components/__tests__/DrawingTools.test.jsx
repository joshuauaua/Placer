import { describe, it, expect } from 'vite-plus/test';
import { hexToHueSat, hsvToHex } from '../DrawingTools';

describe('the colour wheel\'s colours', () => {
  it('turns hue, strength and brightness into hex', () => {
    expect(hsvToHex(0, 1, 1)).toBe('#FF0000');
    expect(hsvToHex(120, 1, 1)).toBe('#00FF00');
    expect(hsvToHex(240, 1, 1)).toBe('#0000FF');
    expect(hsvToHex(0, 0, 1)).toBe('#FFFFFF');
  });

  it('finds a colour\'s place on the wheel again', () => {
    expect(hexToHueSat('#FF0000')).toEqual({ h: 0, s: 1 });
    const { h, s } = hexToHueSat(hsvToHex(200, 0.5, 1));
    expect(h).toBeCloseTo(200, 0);
    expect(s).toBeCloseTo(0.5, 1);
  });
});
