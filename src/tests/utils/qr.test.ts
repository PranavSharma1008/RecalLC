import { describe, expect, it } from 'vitest';

import { generateQrDataUrl, generateQrMatrix, generateQrSvg } from '../../utils/qr';

describe('Offline QR Code Generator', () => {
  const sampleUpi = 'upi://pay?pa=pranavsharma@upi&pn=Pranav%20Sharma&am=89&cu=INR&tn=Support%20RecallLC%20extension';

  it('generates a valid 2D boolean matrix of appropriate dimensions', () => {
    const matrix = generateQrMatrix(sampleUpi);
    expect(Array.isArray(matrix)).toBe(true);
    expect(matrix.length).toBeGreaterThanOrEqual(21);
    expect(matrix[0]?.length).toBe(matrix.length); // Square matrix

    // Top-left finder pattern corner must be black (true)
    expect(matrix[0]![0]).toBe(true);
    expect(matrix[6]![0]).toBe(true);
    expect(matrix[0]![6]).toBe(true);
    // Center of finder pattern (2, 2) must be black
    expect(matrix[2]![2]).toBe(true);
  });

  it('generates an SVG string with crisp rendering and no external resources', () => {
    const svg = generateQrSvg(sampleUpi, 220);
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 220 220"');
    expect(svg).toContain('width="220"');
    expect(svg).toContain('height="220"');
    expect(svg).toContain('<rect');
    expect(svg).toContain('shape-rendering="crispEdges"');
    // Ensure no http/https URLs exist inside the SVG
    expect(svg).not.toMatch(/href=[\'"]https?:/i);
  });

  it('generates a valid SVG Data URL for direct image src embedding', () => {
    const dataUrl = generateQrDataUrl(sampleUpi, 200);
    expect(dataUrl.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    const decoded = decodeURIComponent(dataUrl.replace('data:image/svg+xml;charset=utf-8,', ''));
    expect(decoded).toContain('<svg');
    expect(decoded).toContain('viewBox="0 0 200 200"');
  });

  it('handles short and medium strings deterministically', () => {
    const svg1 = generateQrSvg('hello', 100);
    const svg2 = generateQrSvg('hello', 100);
    expect(svg1).toBe(svg2);

    const svgLong = generateQrSvg('https://github.com/sponsors/PranavSharma1008', 250);
    expect(svgLong).toContain('viewBox="0 0 250 250"');
  });
});
