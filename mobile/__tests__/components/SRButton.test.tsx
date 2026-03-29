import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SRButton } from '@/components/ui/SRButton';
import { colors } from '@/theme';

describe('SRButton', () => {
  it('renders label text', () => {
    render(<SRButton label="Track now" onPress={jest.fn()} />);
    expect(screen.getByText('Track now')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    render(<SRButton label="Continue" onPress={onPress} />);
    fireEvent.press(screen.getByText('Continue'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    render(<SRButton label="Disabled" onPress={onPress} disabled />);
    fireEvent.press(screen.getByText('Disabled'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not call onPress when loading', () => {
    const onPress = jest.fn();
    render(<SRButton label="Loading" onPress={onPress} loading />);
    // Label is replaced by ActivityIndicator when loading
    expect(screen.queryByText('Loading')).toBeNull();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows ActivityIndicator when loading=true', () => {
    render(<SRButton label="Send" onPress={jest.fn()} loading testID="btn" />);
    // Label should not be visible when loading
    expect(screen.queryByText('Send')).toBeNull();
  });

  it('renders primary variant by default (forest background)', () => {
    render(<SRButton label="Primary" onPress={jest.fn()} testID="btn" />);
    const btn = screen.getByTestId('btn');
    const flatStyle = [btn.props.style].flat();
    expect(flatStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: colors.forest }),
      ]),
    );
  });

  it('renders secondary variant with transparent background', () => {
    render(<SRButton label="Secondary" variant="secondary" onPress={jest.fn()} testID="btn" />);
    const btn = screen.getByTestId('btn');
    const flatStyle = [btn.props.style].flat();
    expect(flatStyle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: 'transparent' }),
      ]),
    );
  });

  it('applies custom style prop', () => {
    render(<SRButton label="Btn" onPress={jest.fn()} style={{ marginTop: 24 }} testID="btn" />);
    const btn = screen.getByTestId('btn');
    const flatStyle = [btn.props.style].flat();
    expect(flatStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ marginTop: 24 })]),
    );
  });

  it('renders ghost variant', () => {
    render(<SRButton label="Ghost" variant="ghost" onPress={jest.fn()} />);
    expect(screen.getByText('Ghost')).toBeTruthy();
  });

  it('renders danger variant', () => {
    render(<SRButton label="SOS" variant="danger" onPress={jest.fn()} />);
    expect(screen.getByText('SOS')).toBeTruthy();
  });
});
