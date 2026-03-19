import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Simple test component
const TestComponent = ({ name }: { name: string }) => (
  <div data-testid="test-component">Hello {name}!</div>
);

describe('Simple Test', () => {
  it('renders a test component', () => {
    render(<TestComponent name="World" />);
    expect(screen.getByTestId('test-component')).toBeInTheDocument();
    expect(screen.getByText('Hello World!')).toBeInTheDocument();
  });
});