import { TextExtractorService } from '../extractors/text-extractor.service';

describe('TextExtractorService', () => {
  let service: TextExtractorService;

  beforeEach(() => {
    service = new TextExtractorService();
  });

  describe('extract', () => {
    it('should extract text from UTF-8 buffer', () => {
      const text = 'Hello, world!';
      const buffer = Buffer.from(text, 'utf-8');

      const result = service.extract(buffer);

      expect(result.text).toBe(text);
      expect(result.metadata).toEqual({});
    });

    it('should trim whitespace', () => {
      const buffer = Buffer.from('  Hello, world!  \n\n', 'utf-8');

      const result = service.extract(buffer);

      expect(result.text).toBe('Hello, world!');
    });

    it('should remove BOM character', () => {
      const textWithBom = '\uFEFFHello, world!';
      const buffer = Buffer.from(textWithBom, 'utf-8');

      const result = service.extract(buffer);

      expect(result.text).toBe('Hello, world!');
    });

    it('should handle multi-line text', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const buffer = Buffer.from(text, 'utf-8');

      const result = service.extract(buffer);

      expect(result.text).toBe(text);
    });

    it('should handle special characters', () => {
      const text = 'Héllo, wörld! 你好世界';
      const buffer = Buffer.from(text, 'utf-8');

      const result = service.extract(buffer);

      expect(result.text).toBe(text);
    });
  });

  describe('extractText', () => {
    it('should return just the text string', () => {
      const text = 'Hello, world!';
      const buffer = Buffer.from(text, 'utf-8');

      const result = service.extractText(buffer);

      expect(result).toBe(text);
    });
  });
});
