import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SRText } from '@/components/ui/SRText';
import { colors, typography } from '@/theme';

describe('SRText', () => {
  it('renders children correctly', () => {
    render(<SRText>Hello SafeRide</SRText>);
    expect(screen.getByText('Hello SafeRide')).toBeTruthy();
  });

  it('defaults to body variant', () => {
    render(<SRText testID="t">Body text</SRText>);
    const el = screen.getByTestId('t');
    expect(el.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fontSize: typography.body.fontSize }),
      ]),
    );
  });

  it('applies display variant styles', () => {
    render(<SRText variant="display" testID="t">Display</SRText>);
    const el = screen.getByTestId('t');
    expect(el.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fontSize: typography.display.fontSize }),
      ]),
    );
  });

  it('applies heading variant styles', () => {
    render(<SRText variant="heading" testID="t">Heading</SRText>);
    const el = screen.getByTestId('t');
    expect(el.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fontSize: typography.heading.fontSize }),
      ]),
    );
  });

  it('uses forest color for display variant by default', () => {
    render(<SRText variant="display" testID="t">Display</SRText>);
    const el = screen.getByTestId('t');
    expect(el.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: colors.forest }),
      ]),
    );
  });

  it('uses custom color when provided', () => {
    render(<SRText color={colors.gold} testID="t">Gold text</SRText>);
    const el = screen.getByTestId('t');
    expect(el.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: colors.gold }),
      ]),
    );
  });

  it('caption variant uses muted color by default', () => {
    render(<SRText variant="caption" testID="t">Caption</SRText>);
    const el = screen.getByTestId('t');
    expect(el.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: colors.textMuted }),
      ]),
    );
  });

  it('merges extra style prop', () => {
    render(<SRText style={{ marginTop: 16 }} testID="t">Styled</SRText>);
    const el = screen.getByTestId('t');
    const flatStyle = [el.props.style].flat();
    expect(flatStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ marginTop: 16 })]),
    );
  });

  it('passes through testID and other TextProps', () => {
    render(<SRText testID="custom-id" numberOfLines={1}>Text</SRText>);
    expect(screen.getByTestId('custom-id')).toBeTruthy();
  });
});
