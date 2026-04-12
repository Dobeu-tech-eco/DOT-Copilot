import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../store/authStore';

// Mock the auth store
vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn()
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Layout Component', () => {
  const mockUser = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'ADMIN'
  };

  const mockLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  describe('Happy Path - Authenticated User', () => {
    beforeEach(() => {
      (useAuthStore as any).mockReturnValue({
        user: mockUser,
        logout: mockLogout,
        isAuthenticated: true
      });
    });

    it('renders layout with all navigation items for admin', () => {
      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      expect(screen.getByText('DOT Copilot')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Training')).toBeInTheDocument();
      expect(screen.getByText('Supervisor')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
    });

    it('displays user information in sidebar footer', () => {
      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('ADMIN')).toBeInTheDocument();
    });

    it('renders logout button', () => {
      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      expect(logoutButton).toBeInTheDocument();
    });

    it('renders main content outlet', () => {
      const { container } = render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const mainContent = container.querySelector('.main-content');
      expect(mainContent).toBeInTheDocument();
    });
  });

  describe('Role-Based Navigation', () => {
    it('shows all nav items for ADMIN role', () => {
      (useAuthStore as any).mockReturnValue({
        user: { ...mockUser, role: 'ADMIN' },
        logout: mockLogout,
        isAuthenticated: true
      });

      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Training')).toBeInTheDocument();
      expect(screen.getByText('Supervisor')).toBeInTheDocument();
      expect(screen.getByText('Users')).toBeInTheDocument();
    });

    it('hides admin-only items for SUPERVISOR role', () => {
      (useAuthStore as any).mockReturnValue({
        user: { ...mockUser, role: 'SUPERVISOR' },
        logout: mockLogout,
        isAuthenticated: true
      });

      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Training')).toBeInTheDocument();
      expect(screen.getByText('Supervisor')).toBeInTheDocument();
      expect(screen.queryByText('Users')).not.toBeInTheDocument();
    });

    it('shows only dashboard for DRIVER role', () => {
      (useAuthStore as any).mockReturnValue({
        user: { ...mockUser, role: 'DRIVER' },
        logout: mockLogout,
        isAuthenticated: true
      });

      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Training')).not.toBeInTheDocument();
      expect(screen.queryByText('Supervisor')).not.toBeInTheDocument();
      expect(screen.queryByText('Users')).not.toBeInTheDocument();
    });

    it('handles undefined role gracefully', () => {
      (useAuthStore as any).mockReturnValue({
        user: { ...mockUser, role: undefined },
        logout: mockLogout,
        isAuthenticated: true
      });

      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Training')).not.toBeInTheDocument();
    });
  });

  describe('User Interactions - Navigation', () => {
    beforeEach(() => {
      (useAuthStore as any).mockReturnValue({
        user: mockUser,
        logout: mockLogout,
        isAuthenticated: true
      });
    });

    it('navigates to dashboard when clicked', () => {
      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const dashboardButton = screen.getByText('Dashboard').closest('button');
      fireEvent.click(dashboardButton!);

      expect(mockNavigate).toHaveBeenCalledWith('/driver-dashboard');
    });

    it('navigates to training when clicked', () => {
      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const trainingButton = screen.getByText('Training').closest('button');
      fireEvent.click(trainingButton!);

      expect(mockNavigate).toHaveBeenCalledWith('/training-builder');
    });

    it('navigates to supervisor when clicked', () => {
      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const supervisorButton = screen.getByText('Supervisor').closest('button');
      fireEvent.click(supervisorButton!);

      expect(mockNavigate).toHaveBeenCalledWith('/supervisor');
    });

    it('navigates to users when clicked', () => {
      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const usersButton = screen.getByText('Users').closest('button');
      fireEvent.click(usersButton!);

      expect(mockNavigate).toHaveBeenCalledWith('/user-management');
    });
  });

  describe('User Interactions - Logout', () => {
    beforeEach(() => {
      (useAuthStore as any).mockReturnValue({
        user: mockUser,
        logout: mockLogout,
        isAuthenticated: true
      });
    });

    it('calls logout when logout button is clicked', async () => {
      mockLogout.mockResolvedValue(undefined);

      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalledTimes(1);
      });
    });

    it('navigates to home after logout', async () => {
      mockLogout.mockResolvedValue(undefined);

      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      fireEvent.click(logoutButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });
    });

    it('handles logout errors gracefully', async () => {
      mockLogout.mockRejectedValue(new Error('Logout failed'));

      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      
      await expect(async () => {
        fireEvent.click(logoutButton);
        await waitFor(() => expect(mockLogout).toHaveBeenCalled());
      }).rejects.toThrow();
    });
  });

  describe('Active Navigation State', () => {
    it('highlights active navigation item', () => {
      (useAuthStore as any).mockReturnValue({
        user: mockUser,
        logout: mockLogout,
        isAuthenticated: true
      });

      render(
        <MemoryRouter initialEntries={['/driver-dashboard']}>
          <Layout />
        </MemoryRouter>
      );

      const dashboardButton = screen.getByText('Dashboard').closest('button');
      expect(dashboardButton).toHaveClass('active');
    });

    it('does not highlight inactive navigation items', () => {
      (useAuthStore as any).mockReturnValue({
        user: mockUser,
        logout: mockLogout,
        isAuthenticated: true
      });

      render(
        <MemoryRouter initialEntries={['/driver-dashboard']}>
          <Layout />
        </MemoryRouter>
      );

      const trainingButton = screen.getByText('Training').closest('button');
      expect(trainingButton).not.toHaveClass('active');
    });

    it('updates active state when route changes', () => {
      (useAuthStore as any).mockReturnValue({
        user: mockUser,
        logout: mockLogout,
        isAuthenticated: true
      });

      const { rerender } = render(
        <MemoryRouter initialEntries={['/driver-dashboard']}>
          <Layout />
        </MemoryRouter>
      );

      let dashboardButton = screen.getByText('Dashboard').closest('button');
      expect(dashboardButton).toHaveClass('active');

      rerender(
        <MemoryRouter initialEntries={['/training-builder']}>
          <Layout />
        </MemoryRouter>
      );

      const trainingButton = screen.getByText('Training').closest('button');
      expect(trainingButton).toHaveClass('active');
    });
  });

  describe('Unauthenticated State', () => {
    it('renders only outlet when not authenticated', () => {
      (useAuthStore as any).mockReturnValue({
        user: null,
        logout: mockLogout,
        isAuthenticated: false
      });

      const { container } = render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      expect(screen.queryByText('DOT Copilot')).not.toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
      expect(container.querySelector('.sidebar')).not.toBeInTheDocument();
    });

    it('does not render navigation when not authenticated', () => {
      (useAuthStore as any).mockReturnValue({
        user: null,
        logout: mockLogout,
        isAuthenticated: false
      });

      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Training')).not.toBeInTheDocument();
      expect(screen.queryByText('Supervisor')).not.toBeInTheDocument();
      expect(screen.queryByText('Users')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases - User Data', () => {
    it('displays email when name is not available', () => {
      (useAuthStore as any).mockReturnValue({
        user: { ...mockUser, name: undefined },
        logout: mockLogout,
        isAuthenticated: true
      });

      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    it('handles null user gracefully when authenticated', () => {
      (useAuthStore as any).mockReturnValue({
        user: null,
        logout: mockLogout,
        isAuthenticated: true
      });

      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const userInfo = document.querySelector('.user-info');
      expect(userInfo).toBeInTheDocument();
    });

    it('handles empty string name', () => {
      (useAuthStore as any).mockReturnValue({
        user: { ...mockUser, name: '' },
        logout: mockLogout,
        isAuthenticated: true
      });

      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    it('handles empty string role', () => {
      (useAuthStore as any).mockReturnValue({
        user: { ...mockUser, role: '' },
        logout: mockLogout,
        isAuthenticated: true
      });

      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const roleElement = document.querySelector('.user-role');
      expect(roleElement).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      (useAuthStore as any).mockReturnValue({
        user: mockUser,
        logout: mockLogout,
        isAuthenticated: true
      });
    });

    it('navigation items are keyboard accessible', () => {
      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const dashboardButton = screen.getByText('Dashboard').closest('button');
      dashboardButton?.focus();

      expect(document.activeElement).toBe(dashboardButton);
    });

    it('logout button is keyboard accessible', () => {
      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      logoutButton.focus();

      expect(document.activeElement).toBe(logoutButton);
    });

    it('navigation can be activated with Enter key', () => {
      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const dashboardButton = screen.getByText('Dashboard').closest('button');
      fireEvent.keyDown(dashboardButton!, { key: 'Enter', code: 'Enter' });

      expect(mockNavigate).toHaveBeenCalledWith('/driver-dashboard');
    });

    it('has semantic HTML structure', () => {
      const { container } = render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      expect(container.querySelector('aside')).toBeInTheDocument();
      expect(container.querySelector('nav')).toBeInTheDocument();
      expect(container.querySelector('main')).toBeInTheDocument();
    });

    it('navigation icons are visible', () => {
      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      expect(screen.getByText('📊')).toBeInTheDocument(); // Dashboard
      expect(screen.getByText('📚')).toBeInTheDocument(); // Training
      expect(screen.getByText('👥')).toBeInTheDocument(); // Supervisor
      expect(screen.getByText('⚙️')).toBeInTheDocument(); // Users
    });
  });

  describe('Component Structure', () => {
    beforeEach(() => {
      (useAuthStore as any).mockReturnValue({
        user: mockUser,
        logout: mockLogout,
        isAuthenticated: true
      });
    });

    it('has correct CSS class structure', () => {
      const { container } = render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      expect(container.querySelector('.layout')).toBeInTheDocument();
      expect(container.querySelector('.sidebar')).toBeInTheDocument();
      expect(container.querySelector('.sidebar-header')).toBeInTheDocument();
      expect(container.querySelector('.sidebar-nav')).toBeInTheDocument();
      expect(container.querySelector('.sidebar-footer')).toBeInTheDocument();
      expect(container.querySelector('.main-content')).toBeInTheDocument();
    });

    it('renders all navigation item components', () => {
      const { container } = render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const navItems = container.querySelectorAll('.nav-item');
      expect(navItems.length).toBeGreaterThan(0);

      navItems.forEach(item => {
        expect(item.querySelector('.nav-icon')).toBeInTheDocument();
        expect(item.querySelector('.nav-label')).toBeInTheDocument();
      });
    });

    it('renders user info section correctly', () => {
      const { container } = render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const userInfo = container.querySelector('.user-info');
      expect(userInfo).toBeInTheDocument();
      expect(userInfo?.querySelector('.user-name')).toBeInTheDocument();
      expect(userInfo?.querySelector('.user-role')).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('handles transition from unauthenticated to authenticated', () => {
      (useAuthStore as any).mockReturnValue({
        user: null,
        logout: mockLogout,
        isAuthenticated: false
      });

      const { rerender } = render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      expect(screen.queryByText('DOT Copilot')).not.toBeInTheDocument();

      (useAuthStore as any).mockReturnValue({
        user: mockUser,
        logout: mockLogout,
        isAuthenticated: true
      });

      rerender(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      expect(screen.getByText('DOT Copilot')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles missing user data gracefully', () => {
      (useAuthStore as any).mockReturnValue({
        user: {},
        logout: mockLogout,
        isAuthenticated: true
      });

      expect(() => {
        render(
          <MemoryRouter>
            <Layout />
          </MemoryRouter>
        );
      }).not.toThrow();
    });

    it('handles navigation errors gracefully', () => {
      (useAuthStore as any).mockReturnValue({
        user: mockUser,
        logout: mockLogout,
        isAuthenticated: true
      });

      mockNavigate.mockImplementation(() => {
        throw new Error('Navigation failed');
      });

      render(
        <MemoryRouter>
          <Layout />
        </MemoryRouter>
      );

      const dashboardButton = screen.getByText('Dashboard').closest('button');
      
      expect(() => {
        fireEvent.click(dashboardButton!);
      }).toThrow('Navigation failed');
    });
  });
});
