import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiRequestError } from '../lib/api';
import {
  Avatar,
  ErrorState,
  Input,
  Pager,
  ProgressBar,
  SortTh,
  Tabs,
  sortRows,
} from '../components/ui';
import { ToastProvider, useToast } from '../components/toast';

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

  it('ProgressBar exposes its value', () => {
    render(<ProgressBar value={0.42} label="Fractions mastery" />);
    expect(screen.getByRole('progressbar', { name: 'Fractions mastery' })).toHaveAttribute(
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

  it('Tabs switch the selected tab and report it', async () => {
    function Demo() {
      const [tab, setTab] = useState<'a' | 'b'>('a');
      return (
        <>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'a', label: 'Overview' },
              { id: 'b', label: 'Students', count: 14 },
            ]}
          />
          <p>current: {tab}</p>
        </>
      );
    }
    render(<Demo />);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: /Students/ }));
    expect(screen.getByText('current: b')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Students/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('SortTh announces its sort direction and fires onSort', async () => {
    const onSort = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <SortTh active dir="desc" onSort={onSort}>
              Accuracy
            </SortTh>
          </tr>
        </thead>
      </table>,
    );
    expect(screen.getByRole('columnheader', { name: 'Accuracy' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Accuracy' }));
    expect(onSort).toHaveBeenCalledOnce();
  });

  it('sortRows sorts text and numbers in both directions', () => {
    const rows = [
      { n: 'b', v: 2 },
      { n: 'a', v: 10 },
      { n: 'c', v: 1 },
    ];
    expect(sortRows(rows, (r) => r.n, 'asc').map((r) => r.n)).toEqual(['a', 'b', 'c']);
    expect(sortRows(rows, (r) => r.v, 'desc').map((r) => r.v)).toEqual([10, 2, 1]);
  });

  it('Avatar shows initials and keeps its colour stable', () => {
    const { container, rerender } = render(<Avatar name="Ben Lee" />);
    expect(container.textContent).toBe('BL');
    const first = container.firstElementChild!.className;
    rerender(<Avatar name="Ben Lee" />);
    expect(container.firstElementChild!.className).toBe(first);
  });
});

describe('toasts', () => {
  it('announces a message and can be dismissed', async () => {
    function Demo() {
      const toast = useToast();
      return <button onClick={() => toast.success('Class created')}>Create</button>;
    }
    render(
      <ToastProvider>
        <Demo />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('status')).toHaveTextContent('Class created');
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
