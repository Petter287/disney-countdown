import { describe, expect, it } from 'vitest';
import { MAX_TRIP_IMAGE_BYTES, validateTripImage } from './trip-images';

describe('validateTripImage', () => {
  it('accepts supported images within the size limit', () => {
    expect(validateTripImage({ type: 'image/webp', size: 1024 })).toBeNull();
  });

  it('rejects unsupported formats', () => {
    expect(validateTripImage({ type: 'image/svg+xml', size: 1024 })).toContain('JPG');
  });

  it('rejects empty and oversized files', () => {
    expect(validateTripImage({ type: 'image/png', size: 0 })).toContain('vacía');
    expect(validateTripImage({ type: 'image/jpeg', size: MAX_TRIP_IMAGE_BYTES + 1 })).toContain('4 MB');
  });
});
