import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SRBadge } from '@/components/ui/SRBadge';
import { colors } from '@/theme';

describe('SRBadge', () => {
  it('renders label text', () => {
    render(<SRBadge label="On Route" />);
    expect(screen.getByText('ON ROUTE')).toBeTruthy(); // label variant uppercases
  });

  it('renders active variant with sage background', () => {
    render(<SRBadge label="Active" variant="active" testID="badge" />);
    const badge = screen.getByTestId('badge');
    const flatStyle = [badge.props.style].flat();
    expect(flatStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: colors.badgeActiveBg }),
      ]),
    );
  });

  it('renders alert variant with gold background', () => {
    render(<SRBadge label="4 min" variant="alert" testID="badge" />);
    const badge = screen.getByTestId('badge');
    const flatStyle = [badge.props.style].flat();
    expect(flatStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: colors.badgeAlertBg }),
      ]),
    );
  });

  it('renders muted variant by default', () => {
    render(<SRBadge label="48 km/h" testID="badge" />);
    const badge = screen.getByTestId('badge');
    const flatStyle = [badge.props.style].flat();
    expect(flatStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: colors.badgeMutedBg }),
      ]),
    );
  });

  it('applies custom style prop', () => {
    render(<SRBadge label="Test" style={{ marginTop: 8 }} testID="badge" />);
    const badge = screen.getByTestId('badge');
    const flatStyle = [badge.props.style].flat();
    expect(flatStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ marginTop: 8 })]),
    );
  });

  it('never uses red for alerts (brand rule)', () => {
    render(<SRBadge label="Alert" variant="alert" testID="badge" />);
    const badge = screen.getByTestId('badge');
    const flatStyles = [badge.props.style].flat();
    flatStyles.forEach((s: any) => {
      if (s && s.backgroundColor) {
        expect(s.backgroundColor.toLowerCase()).not.toContain('ff0000');
        expect(s.backgroundColor.toLowerCase()).not.toContain('red');
      }
    });
  });
});
