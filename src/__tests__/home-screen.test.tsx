import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import HomeScreen from '@/app/index';

describe('HomeScreen', () => {
  it('shows the placeholder title', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('Repo Reader')).toBeTruthy();
  });
});
