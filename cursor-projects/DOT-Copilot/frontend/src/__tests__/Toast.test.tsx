import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast } from '../components/Toast';

describe('Toast Component', () => {
  let onCloseMock: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    onCloseMock = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Happy Path - All Props', () => {
    it('renders with all props provided', () => {
      render(
        <Toast 
          message="Operation successful" 
          type="success" 
          duration={3000}
          onClose={onCloseMock}
        />
      );
      
      expect(screen.getByText('Operation successful')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveClass('toast-success');
    });

    it('renders with default props', () => {
      render(<Toast message="Default message" onClose={onCloseMock} />);
      
      expect(screen.getByText('Default message')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveClass('toast-info');
    });
  });

  describe('Toast Types', () => {
    it('renders success toast with correct styling and icon', () => {
      render(<Toast message="Success!" type="success" onClose={onCloseMock} />);
      
      const toast = screen.getByRole('alert');
      expect(toast).toHaveClass('toast-success');
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('renders error toast with correct styling and icon', () => {
      render(<Toast message="Error occurred" type="error" onClose={onCloseMock} />);
      
      const toast = screen.getByRole('alert');
      expect(toast).toHaveClass('toast-error');
      expect(screen.getByText('✕')).toBeInTheDocument();
    });

    it('renders warning toast with correct styling and icon', () => {
      render(<Toast message="Warning!" type="warning" onClose={onCloseMock} />);
      
      const toast = screen.getByRole('alert');
      expect(toast).toHaveClass('toast-warning');
      expect(screen.getByText('⚠')).toBeInTheDocument();
    });

    it('renders info toast with correct styling and icon', () => {
      render(<Toast message="Information" type="info" onClose={onCloseMock} />);
      
      const toast = screen.getByRole('alert');
      expect(toast).toHaveClass('toast-info');
      expect(screen.getByText('ℹ')).toBeInTheDocument();
    });
  });

  describe('Auto-dismiss Functionality', () => {
    it('calls onClose after default duration (5000ms)', () => {
      render(<Toast message="Auto dismiss" onClose={onCloseMock} />);
      
      expect(onCloseMock).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(5000);
      
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('calls onClose after custom duration', () => {
      render(<Toast message="Custom duration" duration={2000} onClose={onCloseMock} />);
      
      expect(onCloseMock).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(2000);
      
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose before duration expires', () => {
      render(<Toast message="Wait for it" duration={3000} onClose={onCloseMock} />);
      
      vi.advanceTimersByTime(2999);
      expect(onCloseMock).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(1);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('clears timer on unmount', () => {
      const { unmount } = render(<Toast message="Unmount test" onClose={onCloseMock} />);
      
      unmount();
      vi.advanceTimersByTime(5000);
      
      expect(onCloseMock).not.toHaveBeenCalled();
    });
  });

  describe('User Interactions - Close Button', () => {
    it('calls onClose when close button is clicked', () => {
      render(<Toast message="Click to close" onClose={onCloseMock} />);
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);
      
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('close button has correct aria-label', () => {
      render(<Toast message="Accessibility test" onClose={onCloseMock} />);
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toHaveAttribute('aria-label', 'Close');
    });

    it('close button displays × symbol', () => {
      render(<Toast message="Symbol test" onClose={onCloseMock} />);
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toHaveTextContent('×');
    });

    it('can be closed multiple times if re-rendered', () => {
      const { rerender } = render(<Toast message="First" onClose={onCloseMock} />);
      
      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      expect(onCloseMock).toHaveBeenCalledTimes(1);
      
      rerender(<Toast message="Second" onClose={onCloseMock} />);
      fireEvent.click(screen.getByRole('button', { name: /close/i }));
      expect(onCloseMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('Message Display', () => {
    it('displays short message correctly', () => {
      render(<Toast message="Short" onClose={onCloseMock} />);
      
      expect(screen.getByText('Short')).toBeInTheDocument();
      expect(screen.getByText('Short')).toHaveClass('toast-message');
    });

    it('displays long message correctly', () => {
      const longMessage = 'This is a very long message that should still be displayed correctly in the toast notification component without any issues';
      render(<Toast message={longMessage} onClose={onCloseMock} />);
      
      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('displays message with special characters', () => {
      const specialMessage = 'Error: File "test.txt" couldn\'t be saved! (Code: 500)';
      render(<Toast message={specialMessage} onClose={onCloseMock} />);
      
      expect(screen.getByText(specialMessage)).toBeInTheDocument();
    });

    it('displays message with HTML entities correctly', () => {
      const htmlMessage = '<div>Test & "quotes"</div>';
      render(<Toast message={htmlMessage} onClose={onCloseMock} />);
      
      expect(screen.getByText(htmlMessage)).toBeInTheDocument();
    });
  });

  describe('Edge Cases - Null/Undefined/Empty', () => {
    it('handles empty string message', () => {
      const { container } = render(<Toast message="" onClose={onCloseMock} />);
      
      const toast = screen.getByRole('alert');
      expect(toast).toBeInTheDocument();
      expect(container.querySelector('.toast-message')).toBeInTheDocument();
    });

    it('handles zero duration', () => {
      render(<Toast message="Zero duration" duration={0} onClose={onCloseMock} />);
      
      vi.advanceTimersByTime(0);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('handles very long duration', () => {
      render(<Toast message="Long duration" duration={999999} onClose={onCloseMock} />);
      
      vi.advanceTimersByTime(999998);
      expect(onCloseMock).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(1);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('handles negative duration gracefully', () => {
      render(<Toast message="Negative duration" duration={-1000} onClose={onCloseMock} />);
      
      const toast = screen.getByRole('alert');
      expect(toast).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has role="alert" for screen readers', () => {
      render(<Toast message="Alert test" onClose={onCloseMock} />);
      
      const toast = screen.getByRole('alert');
      expect(toast).toBeInTheDocument();
    });

    it('close button is keyboard accessible', () => {
      render(<Toast message="Keyboard test" onClose={onCloseMock} />);
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      closeButton.focus();
      
      expect(document.activeElement).toBe(closeButton);
    });

    it('close button can be activated with Enter key', () => {
      render(<Toast message="Enter key test" onClose={onCloseMock} />);
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      closeButton.focus();
      fireEvent.keyDown(closeButton, { key: 'Enter', code: 'Enter' });
      
      expect(onCloseMock).toHaveBeenCalled();
    });

    it('close button can be activated with Space key', () => {
      render(<Toast message="Space key test" onClose={onCloseMock} />);
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      closeButton.focus();
      fireEvent.keyDown(closeButton, { key: ' ', code: 'Space' });
      
      expect(onCloseMock).toHaveBeenCalled();
    });

    it('icon is visible and has semantic meaning', () => {
      render(<Toast message="Icon test" type="success" onClose={onCloseMock} />);
      
      const icon = screen.getByText('✓');
      expect(icon).toHaveClass('toast-icon');
      expect(icon).toBeVisible();
    });
  });

  describe('Component Structure', () => {
    it('has correct CSS class structure', () => {
      render(<Toast message="Structure test" type="error" onClose={onCloseMock} />);
      
      const toast = screen.getByRole('alert');
      expect(toast).toHaveClass('toast', 'toast-error');
      
      const content = toast.querySelector('.toast-content');
      expect(content).toBeInTheDocument();
      
      const icon = content?.querySelector('.toast-icon');
      expect(icon).toBeInTheDocument();
      
      const message = content?.querySelector('.toast-message');
      expect(message).toBeInTheDocument();
      
      const closeButton = toast.querySelector('.toast-close');
      expect(closeButton).toBeInTheDocument();
    });

    it('maintains structure across different types', () => {
      const types: Array<'success' | 'error' | 'warning' | 'info'> = ['success', 'error', 'warning', 'info'];
      
      types.forEach(type => {
        const { unmount } = render(<Toast message={`${type} message`} type={type} onClose={onCloseMock} />);
        
        const toast = screen.getByRole('alert');
        expect(toast).toHaveClass(`toast-${type}`);
        expect(toast.querySelector('.toast-content')).toBeInTheDocument();
        expect(toast.querySelector('.toast-icon')).toBeInTheDocument();
        expect(toast.querySelector('.toast-message')).toBeInTheDocument();
        expect(toast.querySelector('.toast-close')).toBeInTheDocument();
        
        unmount();
      });
    });
  });

  describe('Timer Behavior', () => {
    it('resets timer when duration prop changes', () => {
      const { rerender } = render(
        <Toast message="Timer test" duration={5000} onClose={onCloseMock} />
      );
      
      vi.advanceTimersByTime(3000);
      expect(onCloseMock).not.toHaveBeenCalled();
      
      rerender(<Toast message="Timer test" duration={2000} onClose={onCloseMock} />);
      
      vi.advanceTimersByTime(2000);
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('resets timer when onClose prop changes', () => {
      const newOnClose = vi.fn();
      const { rerender } = render(
        <Toast message="OnClose test" duration={3000} onClose={onCloseMock} />
      );
      
      vi.advanceTimersByTime(2000);
      
      rerender(<Toast message="OnClose test" duration={3000} onClose={newOnClose} />);
      
      vi.advanceTimersByTime(3000);
      expect(onCloseMock).not.toHaveBeenCalled();
      expect(newOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multiple Toast Instances', () => {
    it('handles multiple toasts independently', () => {
      const onClose1 = vi.fn();
      const onClose2 = vi.fn();
      
      render(
        <>
          <Toast message="Toast 1" duration={2000} onClose={onClose1} />
          <Toast message="Toast 2" duration={4000} onClose={onClose2} />
        </>
      );
      
      expect(screen.getByText('Toast 1')).toBeInTheDocument();
      expect(screen.getByText('Toast 2')).toBeInTheDocument();
      
      vi.advanceTimersByTime(2000);
      expect(onClose1).toHaveBeenCalledTimes(1);
      expect(onClose2).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(2000);
      expect(onClose2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error States', () => {
    it('handles missing onClose gracefully', () => {
      expect(() => {
        render(<Toast message="No onClose" onClose={undefined as any} />);
      }).not.toThrow();
    });

    it('renders even with invalid type', () => {
      render(<Toast message="Invalid type" type={'invalid' as any} onClose={onCloseMock} />);
      
      const toast = screen.getByRole('alert');
      expect(toast).toBeInTheDocument();
    });
  });
});
