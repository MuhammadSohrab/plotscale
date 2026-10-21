import { afterEach, describe, expect, it, vi } from 'vitest';

const pdf = {
  addImage: vi.fn(),
  addPage: vi.fn(),
  circle: vi.fn(),
  getNumberOfPages: vi.fn(() => 3),
  getTextWidth: vi.fn((text) => String(text).length * 0.5),
  line: vi.fn(),
  lines: vi.fn(),
  rect: vi.fn(),
  roundedRect: vi.fn(),
  save: vi.fn(),
  setDrawColor: vi.fn(),
  setFillColor: vi.fn(),
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setLineDashPattern: vi.fn(),
  setLineWidth: vi.fn(),
  setPage: vi.fn(),
  setTextColor: vi.fn(),
  splitTextToSize: vi.fn((text) => [String(text)]),
  text: vi.fn(),
  triangle: vi.fn(),
};

vi.mock('jspdf', () => ({ jsPDF: vi.fn(() => pdf) }));

import { exportMapModePDF } from './mapPdfExport';

describe('exportMapModePDF', () => {
  afterEach(() => {
    vi.clearAllMocks();
    delete globalThis.Image;
  });

  it('exports a polygon with diagonal labels in the selected length unit', async () => {
    globalThis.Image = class MockImage {
      set src(_value) {
        queueMicrotask(() => this.onerror?.());
      }
    };

    await expect(exportMapModePDF({
      points: [
        { lat: 26.7597, lng: 83.3397 },
        { lat: 26.7597, lng: 83.3400 },
        { lat: 26.7594, lng: 83.3400 },
        { lat: 26.7594, lng: 83.3397 },
      ],
      areaSqm: 992,
      sideLabels: ['98.0 ft', '110.0 ft', '98.0 ft', '110.0 ft'],
      lengthUnitSymbol: 'ft',
      lengthFactor: 0.3048,
      plotName: 'Regression Plot',
      mapApiKey: '',
    })).resolves.toBeUndefined();

    expect(pdf.text).toHaveBeenCalledWith(
      expect.stringMatching(/ ft$/),
      expect.any(Number),
      expect.any(Number),
      expect.any(Object),
    );
    expect(pdf.save).toHaveBeenCalledWith('PlotScale-Regression Plot.pdf');
  });
});
