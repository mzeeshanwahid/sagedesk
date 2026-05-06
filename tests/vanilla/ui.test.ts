import { describe, it, expect } from 'vitest';
import { getWidgetStyles, ICON_CHAT, ICON_PERSON, ICON_SEND } from '../../src/vanilla/ui';

describe('ui', () => {
  it('should return styles with accent color', () => {
    const styles = getWidgetStyles('#ff0000');
    expect(styles).toContain('--sd-accent: #ff0000');
    expect(styles).toContain('sd-trigger');
  });

  it('should have valid icons', () => {
    expect(ICON_CHAT).toContain('<svg');
    expect(ICON_PERSON).toContain('<svg');
    expect(ICON_SEND).toContain('<svg');
  });
});
