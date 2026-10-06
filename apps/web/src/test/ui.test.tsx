import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiRequestError } from '../lib/api';
import { ErrorState, Input, Meter, Pager } from '../components/ui';

describe('design system', () => {
  it('ErrorState shows a friendly message and retries', async () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        error={
          new ApiRequestError(500, {
            code: 'INTERNAL',
            message: 'Something went wrong',
            requestId: 'r1',
          })
        }
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('Input links its label and error for screen readers', () => {
    render(<Input label="Email" error="Enter a valid email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid email');
  });

  it('Meter exposes its value', () => {
    render(<Meter value={0.42} label="Fractions mastery" />);
    expect(screen.getByRole('meter', { name: 'Fractions mastery' })).toHaveAttribute(
      'aria-valuenow',
      '42',
    );
  });

  it('Pager hides itself for a single page and pages otherwise', async () => {
    const { rerender } = render(<Pager page={1} pageSize={20} total={5} onPage={() => {}} />);
    expect(screen.queryByRole('navigation')).toBeNull();
    const onPage = vi.fn();
    rerender(<Pager page={1} pageSize={20} total={45} onPage={onPage} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
});
