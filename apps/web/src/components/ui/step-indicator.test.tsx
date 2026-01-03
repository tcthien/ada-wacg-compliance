/**
 * Unit tests for StepIndicator component
 *
 * Tests:
 * - All variants (horizontal, vertical)
 * - All sizes (sm, md, lg)
 * - Step states (completed, current, upcoming)
 * - Click handlers and navigation
 * - Keyboard accessibility (arrow keys, Enter, Space)
 * - allowNavigation prop behavior
 * - showLabels prop
 * - Accessibility attributes (aria-label, aria-current, role)
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepIndicator, type Step } from './step-indicator';

describe('StepIndicator', () => {
  const mockSteps: Step[] = [
    { id: '1', label: 'Step One', description: 'First step description' },
    { id: '2', label: 'Step Two', description: 'Second step description' },
    { id: '3', label: 'Step Three', description: 'Third step description' },
    { id: '4', label: 'Step Four', description: 'Fourth step description' },
  ];

  describe('Rendering', () => {
    it('should render with default props', () => {
      render(<StepIndicator steps={mockSteps} currentStep={0} />);

      expect(screen.getByText('Step One')).toBeInTheDocument();
      expect(screen.getByText('Step Two')).toBeInTheDocument();
      expect(screen.getByText('Step Three')).toBeInTheDocument();
      expect(screen.getByText('Step Four')).toBeInTheDocument();
    });

    it('should have proper ARIA navigation attributes', () => {
      const { container } = render(<StepIndicator steps={mockSteps} currentStep={0} />);

      const nav = container.querySelector('[role="navigation"]');
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute('aria-label', 'Progress steps');
    });

    it('should render all steps', () => {
      render(<StepIndicator steps={mockSteps} currentStep={1} />);

      expect(screen.getByText('Step One')).toBeInTheDocument();
      expect(screen.getByText('Step Two')).toBeInTheDocument();
      expect(screen.getByText('Step Three')).toBeInTheDocument();
      expect(screen.getByText('Step Four')).toBeInTheDocument();
    });

    it('should render step descriptions when provided', () => {
      render(<StepIndicator steps={mockSteps} currentStep={0} />);

      expect(screen.getByText('First step description')).toBeInTheDocument();
      expect(screen.getByText('Second step description')).toBeInTheDocument();
      expect(screen.getByText('Third step description')).toBeInTheDocument();
      expect(screen.getByText('Fourth step description')).toBeInTheDocument();
    });

    it('should render without step descriptions when not provided', () => {
      const stepsWithoutDesc: Step[] = [
        { id: '1', label: 'Step One' },
        { id: '2', label: 'Step Two' },
      ];

      const { container } = render(<StepIndicator steps={stepsWithoutDesc} currentStep={0} />);

      expect(screen.getByText('Step One')).toBeInTheDocument();
      expect(screen.getByText('Step Two')).toBeInTheDocument();

      const descriptions = container.querySelectorAll('.text-muted-foreground.mt-0\\.5');
      expect(descriptions).toHaveLength(0);
    });
  });

  describe('Variants', () => {
    it('should render horizontal variant by default', () => {
      const { container } = render(<StepIndicator steps={mockSteps} currentStep={0} />);

      const stepIndicator = container.querySelector('.step-indicator');
      expect(stepIndicator?.className).toContain('flex');
      expect(stepIndicator?.className).toContain('items-start');
    });

    it('should render horizontal variant correctly', () => {
      const { container } = render(
        <StepIndicator steps={mockSteps} currentStep={0} variant="horizontal" />
      );

      const stepIndicator = container.querySelector('.step-indicator');
      expect(stepIndicator?.className).toContain('flex');
      expect(stepIndicator?.className).toContain('items-start');
    });

    it('should render vertical variant correctly', () => {
      const { container } = render(
        <StepIndicator steps={mockSteps} currentStep={0} variant="vertical" />
      );

      const stepIndicator = container.querySelector('.step-indicator');
      expect(stepIndicator?.className).toContain('flex');
      expect(stepIndicator?.className).toContain('flex-col');
      expect(stepIndicator?.className).toContain('space-y-4');
    });

    it('should apply horizontal layout to step containers', () => {
      const { container } = render(
        <StepIndicator steps={mockSteps} currentStep={0} variant="horizontal" />
      );

      const stepContainers = container.querySelectorAll('.flex-col.items-center');
      expect(stepContainers.length).toBeGreaterThan(0);
    });

    it('should apply vertical layout to step containers', () => {
      const { container } = render(
        <StepIndicator steps={mockSteps} currentStep={0} variant="vertical" />
      );

      const stepContainers = container.querySelectorAll('.w-full');
      expect(stepContainers.length).toBeGreaterThan(0);
    });
  });

  describe('Sizes', () => {
    it('should render medium size by default', () => {
      const { container } = render(<StepIndicator steps={mockSteps} currentStep={0} />);

      const circles = container.querySelectorAll('.h-8.w-8');
      expect(circles.length).toBeGreaterThan(0);
    });

    it('should render small size correctly', () => {
      const { container } = render(
        <StepIndicator steps={mockSteps} currentStep={0} size="sm" />
      );

      const circles = container.querySelectorAll('.h-6.w-6');
      expect(circles.length).toBeGreaterThan(0);

      const labels = container.querySelectorAll('.text-xs');
      expect(labels.length).toBeGreaterThan(0);
    });

    it('should render medium size correctly', () => {
      const { container } = render(
        <StepIndicator steps={mockSteps} currentStep={0} size="md" />
      );

      const circles = container.querySelectorAll('.h-8.w-8');
      expect(circles.length).toBeGreaterThan(0);

      const labels = container.querySelectorAll('.text-sm');
      expect(labels.length).toBeGreaterThan(0);
    });

    it('should render large size correctly', () => {
      const { container } = render(
        <StepIndicator steps={mockSteps} currentStep={0} size="lg" />
      );

      const circles = container.querySelectorAll('.h-10.w-10');
      expect(circles.length).toBeGreaterThan(0);

      const labels = container.querySelectorAll('.text-base');
      expect(labels.length).toBeGreaterThan(0);
    });

    it('should apply correct icon size for small', () => {
      const { container } = render(
        <StepIndicator steps={mockSteps} currentStep={1} size="sm" />
      );

      const checkIcons = container.querySelectorAll('.h-3.w-3');
      expect(checkIcons.length).toBeGreaterThan(0);
    });

    it('should apply correct icon size for medium', () => {
      const { container } = render(
        <StepIndicator steps={mockSteps} currentStep={1} size="md" />
      );

      const checkIcons = container.querySelectorAll('.h-4.w-4');
      expect(checkIcons.length).toBeGreaterThan(0);
    });

    it('should apply correct icon size for large', () => {
      const { container } = render(
        <StepIndicator steps={mockSteps} currentStep={1} size="lg" />
      );

      const checkIcons = container.querySelectorAll('.h-5.w-5');
      expect(checkIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Step states', () => {
    it('should render completed state correctly', () => {
      const { container } = render(<StepIndicator steps={mockSteps} currentStep={2} />);

      // First two steps should be completed (indices 0 and 1)
      const completedCircles = container.querySelectorAll('.bg-primary.border-primary');
      expect(completedCircles.length).toBeGreaterThanOrEqual(2);
    });

    it('should render current state correctly', () => {
      const { container } = render(<StepIndicator steps={mockSteps} currentStep={1} />);

      const currentCircles = container.querySelectorAll('.animate-pulse');
      expect(currentCircles.length).toBeGreaterThan(0);
    });

    it('should render upcoming state correctly', () => {
      const { container } = render(<StepIndicator steps={mockSteps} currentStep={0} />);

      // Steps 1, 2, 3 should be upcoming
      const upcomingCircles = container.querySelectorAll('.text-muted-foreground');
      expect(upcomingCircles.length).toBeGreaterThan(0);
    });

    it('should show check icon for completed steps', () => {
      const { container } = render(<StepIndicator steps={mockSteps} currentStep={2} />);

      const checkIcons = container.querySelectorAll('svg');
      expect(checkIcons.length).toBeGreaterThan(0);
    });

    it('should show step number for current step', () => {
      render(<StepIndicator steps={mockSteps} currentStep={1} />);

      const stepButton = screen.getByRole('button', { name: /step 2/i });
      expect(stepButton).toHaveTextContent('2');
    });

    it('should show step number for upcoming steps', () => {
      render(<StepIndicator steps={mockSteps} currentStep={0} />);

      const step3Button = screen.getByRole('button', { name: /step 3/i });
      expect(step3Button).toHaveTextContent('3');

      const step4Button = screen.getByRole('button', { name: /step 4/i });
      expect(step4Button).toHaveTextContent('4');
    });

    it('should apply correct label styling for completed steps', () => {
      const { container } = render(<StepIndicator steps={mockSteps} currentStep={2} />);

      const completedLabels = container.querySelectorAll('.font-medium');
      expect(completedLabels.length).toBeGreaterThan(0);
    });

    it('should apply correct label styling for current step', () => {
      const { container } = render(<StepIndicator steps={mockSteps} currentStep={1} />);

      const currentLabels = container.querySelectorAll('.text-primary.font-semibold');
      expect(currentLabels.length).toBeGreaterThan(0);
    });

    it('should render connector lines between steps', () => {
      const { container } = render(<StepIndicator steps={mockSteps} currentStep={1} />);

      // Should have 3 connector lines (between 4 steps)
      const lines = container.querySelectorAll('.h-0\\.5.flex-1.mx-2');
      expect(lines).toHaveLength(3);
    });

    it('should show completed state for connector lines before current step', () => {
      const { container } = render(<StepIndicator steps={mockSteps} currentStep={2} />);

      const completedLines = container.querySelectorAll('.bg-primary');
      expect(completedLines.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('showLabels prop', () => {
    it('should show labels by default', () => {
      render(<StepIndicator steps={mockSteps} currentStep={0} />);

      expect(screen.getByText('Step One')).toBeInTheDocument();
      expect(screen.getByText('Step Two')).toBeInTheDocument();
    });

    it('should show labels when showLabels is true', () => {
      render(<StepIndicator steps={mockSteps} currentStep={0} showLabels={true} />);

      expect(screen.getByText('Step One')).toBeInTheDocument();
      expect(screen.getByText('Step Two')).toBeInTheDocument();
      expect(screen.getByText('First step description')).toBeInTheDocument();
    });

    it('should hide labels when showLabels is false', () => {
      render(<StepIndicator steps={mockSteps} currentStep={0} showLabels={false} />);

      expect(screen.queryByText('Step One')).not.toBeInTheDocument();
      expect(screen.queryByText('Step Two')).not.toBeInTheDocument();
      expect(screen.queryByText('First step description')).not.toBeInTheDocument();
    });

    it('should still render step circles when labels are hidden', () => {
      const { container } = render(
        <StepIndicator steps={mockSteps} currentStep={1} showLabels={false} />
      );

      const circles = container.querySelectorAll('[role="button"]');
      expect(circles).toHaveLength(4);
    });
  });

  describe('Click handlers', () => {
    it('should not call onStepClick when allowNavigation is false', () => {
      const onStepClick = vi.fn();

      render(
        <StepIndicator
          steps={mockSteps}
          currentStep={2}
          onStepClick={onStepClick}
          allowNavigation={false}
        />
      );

      const step1Button = screen.getByRole('button', { name: /step 1/i });
      fireEvent.click(step1Button);

      expect(onStepClick).not.toHaveBeenCalled();
    });

    it('should call onStepClick when clicking completed step with allowNavigation', () => {
      const onStepClick = vi.fn();

      render(
        <StepIndicator
          steps={mockSteps}
          currentStep={2}
          onStepClick={onStepClick}
          allowNavigation={true}
        />
      );

      const step1Button = screen.getByRole('button', { name: /step 1/i });
      fireEvent.click(step1Button);

      expect(onStepClick).toHaveBeenCalledWith(0);
    });

    it('should call onStepClick when clicking current step with allowNavigation', () => {
      const onStepClick = vi.fn();

      render(
        <StepIndicator
          steps={mockSteps}
          currentStep={1}
          onStepClick={onStepClick}
          allowNavigation={true}
        />
      );

      const step2Button = screen.getByRole('button', { name: /step 2/i });
      fireEvent.click(step2Button);

      expect(onStepClick).toHaveBeenCalledWith(1);
    });

    it('should not call onStepClick when clicking upcoming step', () => {
      const onStepClick = vi.fn();

      render(
        <StepIndicator
          steps={mockSteps}
          currentStep={1}
          onStepClick={onStepClick}
          allowNavigation={true}
        />
      );

      const step3Button = screen.getByRole('button', { name: /step 3/i });
      fireEvent.click(step3Button);

      expect(onStepClick).not.toHaveBeenCalled();
    });

    it('should apply cursor-pointer to clickable steps', () => {
      const { container } = render(
        <StepIndicator
          steps={mockSteps}
          currentStep={2}
          allowNavigation={true}
          onStepClick={vi.fn()}
        />
      );

      const clickableSteps = container.querySelectorAll('.cursor-pointer');
      expect(clickableSteps.length).toBeGreaterThanOrEqual(3);
    });

    it('should apply hover effect to clickable steps', () => {
      const { container } = render(
        <StepIndicator
          steps={mockSteps}
          currentStep={2}
          allowNavigation={true}
          onStepClick={vi.fn()}
        />
      );

      const hoverableSteps = container.querySelectorAll('.hover\\:scale-110');
      expect(hoverableSteps.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Keyboard accessibility', () => {
    describe('Horizontal variant arrow key navigation', () => {
      it('should navigate forward with ArrowRight', async () => {
        const user = userEvent.setup();
        const onStepClick = vi.fn();

        render(
          <StepIndicator
            steps={mockSteps}
            currentStep={2}
            variant="horizontal"
            onStepClick={onStepClick}
            allowNavigation={true}
          />
        );

        const step1Button = screen.getByRole('button', { name: /step 1/i });
        step1Button.focus();

        await user.keyboard('{ArrowRight}');

        expect(onStepClick).toHaveBeenCalledWith(1);
      });

      it('should navigate backward with ArrowLeft', async () => {
        const user = userEvent.setup();
        const onStepClick = vi.fn();

        render(
          <StepIndicator
            steps={mockSteps}
            currentStep={2}
            variant="horizontal"
            onStepClick={onStepClick}
            allowNavigation={true}
          />
        );

        const step2Button = screen.getByRole('button', { name: /step 2/i });
        step2Button.focus();

        await user.keyboard('{ArrowLeft}');

        expect(onStepClick).toHaveBeenCalledWith(0);
      });

      it('should not navigate beyond current step with ArrowRight', async () => {
        const user = userEvent.setup();
        const onStepClick = vi.fn();

        render(
          <StepIndicator
            steps={mockSteps}
            currentStep={1}
            variant="horizontal"
            onStepClick={onStepClick}
            allowNavigation={true}
          />
        );

        const step2Button = screen.getByRole('button', { name: /step 2/i });
        step2Button.focus();

        await user.keyboard('{ArrowRight}');

        expect(onStepClick).not.toHaveBeenCalled();
      });

      it('should not navigate before first step with ArrowLeft', async () => {
        const user = userEvent.setup();
        const onStepClick = vi.fn();

        render(
          <StepIndicator
            steps={mockSteps}
            currentStep={2}
            variant="horizontal"
            onStepClick={onStepClick}
            allowNavigation={true}
          />
        );

        const step1Button = screen.getByRole('button', { name: /step 1/i });
        step1Button.focus();

        await user.keyboard('{ArrowLeft}');

        expect(onStepClick).not.toHaveBeenCalled();
      });
    });

    describe('Vertical variant arrow key navigation', () => {
      it('should navigate forward with ArrowDown', async () => {
        const user = userEvent.setup();
        const onStepClick = vi.fn();

        render(
          <StepIndicator
            steps={mockSteps}
            currentStep={2}
            variant="vertical"
            onStepClick={onStepClick}
            allowNavigation={true}
          />
        );

        const step1Button = screen.getByRole('button', { name: /step 1/i });
        step1Button.focus();

        await user.keyboard('{ArrowDown}');

        expect(onStepClick).toHaveBeenCalledWith(1);
      });

      it('should navigate backward with ArrowUp', async () => {
        const user = userEvent.setup();
        const onStepClick = vi.fn();

        render(
          <StepIndicator
            steps={mockSteps}
            currentStep={2}
            variant="vertical"
            onStepClick={onStepClick}
            allowNavigation={true}
          />
        );

        const step2Button = screen.getByRole('button', { name: /step 2/i });
        step2Button.focus();

        await user.keyboard('{ArrowUp}');

        expect(onStepClick).toHaveBeenCalledWith(0);
      });

      it('should not navigate with horizontal arrow keys in vertical variant', async () => {
        const user = userEvent.setup();
        const onStepClick = vi.fn();

        render(
          <StepIndicator
            steps={mockSteps}
            currentStep={2}
            variant="vertical"
            onStepClick={onStepClick}
            allowNavigation={true}
          />
        );

        const step1Button = screen.getByRole('button', { name: /step 1/i });
        step1Button.focus();

        await user.keyboard('{ArrowRight}');

        expect(onStepClick).not.toHaveBeenCalled();
      });
    });

    describe('Enter and Space key navigation', () => {
      it('should activate step with Enter key', async () => {
        const user = userEvent.setup();
        const onStepClick = vi.fn();

        render(
          <StepIndicator
            steps={mockSteps}
            currentStep={2}
            onStepClick={onStepClick}
            allowNavigation={true}
          />
        );

        const step1Button = screen.getByRole('button', { name: /step 1/i });
        step1Button.focus();

        await user.keyboard('{Enter}');

        expect(onStepClick).toHaveBeenCalledWith(0);
      });

      it('should activate step with Space key', async () => {
        const user = userEvent.setup();
        const onStepClick = vi.fn();

        render(
          <StepIndicator
            steps={mockSteps}
            currentStep={2}
            onStepClick={onStepClick}
            allowNavigation={true}
          />
        );

        const step1Button = screen.getByRole('button', { name: /step 1/i });
        step1Button.focus();

        await user.keyboard(' ');

        expect(onStepClick).toHaveBeenCalledWith(0);
      });

      it('should not activate upcoming step with Enter', async () => {
        const user = userEvent.setup();
        const onStepClick = vi.fn();

        render(
          <StepIndicator
            steps={mockSteps}
            currentStep={1}
            onStepClick={onStepClick}
            allowNavigation={true}
          />
        );

        const step3Button = screen.getByRole('button', { name: /step 3/i });
        step3Button.focus();

        await user.keyboard('{Enter}');

        expect(onStepClick).not.toHaveBeenCalled();
      });
    });

    it('should not handle keyboard events when allowNavigation is false', async () => {
      const user = userEvent.setup();
      const onStepClick = vi.fn();

      render(
        <StepIndicator
          steps={mockSteps}
          currentStep={2}
          onStepClick={onStepClick}
          allowNavigation={false}
        />
      );

      const step1Button = screen.getByRole('button', { name: /step 1/i });
      step1Button.focus();

      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      await user.keyboard('{ArrowRight}');

      expect(onStepClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility attributes', () => {
    it('should have role="button" for each step', () => {
      render(<StepIndicator steps={mockSteps} currentStep={1} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(4);
    });

    it('should have proper aria-label for each step', () => {
      render(<StepIndicator steps={mockSteps} currentStep={1} />);

      expect(screen.getByRole('button', { name: 'Step 1: Step One' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Step 2: Step Two' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Step 3: Step Three' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Step 4: Step Four' })).toBeInTheDocument();
    });

    it('should have aria-current="step" for current step', () => {
      render(<StepIndicator steps={mockSteps} currentStep={1} />);

      const step2Button = screen.getByRole('button', { name: /step 2/i });
      expect(step2Button).toHaveAttribute('aria-current', 'step');
    });

    it('should not have aria-current for completed steps', () => {
      render(<StepIndicator steps={mockSteps} currentStep={2} />);

      const step1Button = screen.getByRole('button', { name: /step 1/i });
      expect(step1Button).not.toHaveAttribute('aria-current');
    });

    it('should not have aria-current for upcoming steps', () => {
      render(<StepIndicator steps={mockSteps} currentStep={1} />);

      const step3Button = screen.getByRole('button', { name: /step 3/i });
      expect(step3Button).not.toHaveAttribute('aria-current');
    });

    it('should have tabIndex=0 for clickable steps', () => {
      render(
        <StepIndicator
          steps={mockSteps}
          currentStep={2}
          allowNavigation={true}
          onStepClick={vi.fn()}
        />
      );

      const step1Button = screen.getByRole('button', { name: /step 1/i });
      expect(step1Button).toHaveAttribute('tabIndex', '0');

      const step2Button = screen.getByRole('button', { name: /step 2/i });
      expect(step2Button).toHaveAttribute('tabIndex', '0');

      const step3Button = screen.getByRole('button', { name: /step 3/i });
      expect(step3Button).toHaveAttribute('tabIndex', '0');
    });

    it('should have tabIndex=-1 for non-clickable steps', () => {
      render(
        <StepIndicator
          steps={mockSteps}
          currentStep={1}
          allowNavigation={false}
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('tabIndex', '-1');
      });
    });

    it('should have tabIndex=-1 for upcoming steps even with allowNavigation', () => {
      render(
        <StepIndicator
          steps={mockSteps}
          currentStep={1}
          allowNavigation={true}
          onStepClick={vi.fn()}
        />
      );

      const step3Button = screen.getByRole('button', { name: /step 3/i });
      expect(step3Button).toHaveAttribute('tabIndex', '-1');

      const step4Button = screen.getByRole('button', { name: /step 4/i });
      expect(step4Button).toHaveAttribute('tabIndex', '-1');
    });

    it('should have focus-visible styles for clickable steps', () => {
      const { container } = render(
        <StepIndicator
          steps={mockSteps}
          currentStep={2}
          allowNavigation={true}
          onStepClick={vi.fn()}
        />
      );

      const focusableSteps = container.querySelectorAll('.focus-visible\\:outline-none');
      expect(focusableSteps.length).toBeGreaterThanOrEqual(3);
    });

    it('should have aria-hidden on connector lines', () => {
      const { container } = render(<StepIndicator steps={mockSteps} currentStep={1} />);

      const lines = container.querySelectorAll('[aria-hidden="true"]');
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe('Custom className', () => {
    it('should merge custom className with default classes', () => {
      const { container } = render(
        <StepIndicator
          steps={mockSteps}
          currentStep={0}
          className="custom-stepper"
        />
      );

      const stepper = container.querySelector('.custom-stepper');
      expect(stepper).toBeInTheDocument();
      expect(stepper?.className).toContain('step-indicator');
    });
  });

  describe('HTML attributes and ref', () => {
    it('should support data-testid attribute', () => {
      const { container } = render(
        <StepIndicator
          steps={mockSteps}
          currentStep={0}
          data-testid="step-indicator"
        />
      );

      const stepper = container.querySelector('[data-testid="step-indicator"]');
      expect(stepper).toBeInTheDocument();
    });

    it('should support id attribute', () => {
      const { container } = render(
        <StepIndicator
          steps={mockSteps}
          currentStep={0}
          id="my-stepper"
        />
      );

      const stepper = container.querySelector('#my-stepper');
      expect(stepper).toBeInTheDocument();
    });

    it('should forward ref correctly', () => {
      const ref = React.createRef<HTMLDivElement>();
      render(
        <StepIndicator
          steps={mockSteps}
          currentStep={0}
          ref={ref}
        />
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.getAttribute('role')).toBe('navigation');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty steps array', () => {
      const { container } = render(<StepIndicator steps={[]} currentStep={0} />);

      const nav = container.querySelector('[role="navigation"]');
      expect(nav).toBeInTheDocument();

      const buttons = screen.queryAllByRole('button');
      expect(buttons).toHaveLength(0);
    });

    it('should handle single step', () => {
      const singleStep: Step[] = [{ id: '1', label: 'Only Step' }];

      render(<StepIndicator steps={singleStep} currentStep={0} />);

      expect(screen.getByText('Only Step')).toBeInTheDocument();
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
    });

    it('should handle currentStep beyond steps length', () => {
      const { container } = render(<StepIndicator steps={mockSteps} currentStep={10} />);

      // All steps should be completed
      const completedCircles = container.querySelectorAll('.bg-primary.border-primary');
      expect(completedCircles.length).toBe(4);
    });

    it('should handle negative currentStep', () => {
      const { container } = render(<StepIndicator steps={mockSteps} currentStep={-1} />);

      // With negative currentStep, no step is completed, all are upcoming or current
      // currentStep = -1 means step at index -1 is current (no step)
      // So step 0 should NOT be current (it's index 0, currentStep is -1)
      const upcomingSteps = container.querySelectorAll('.text-muted-foreground');
      expect(upcomingSteps.length).toBeGreaterThan(0);
    });

    it('should render without onStepClick callback', () => {
      render(
        <StepIndicator
          steps={mockSteps}
          currentStep={1}
          allowNavigation={true}
        />
      );

      const step1Button = screen.getByRole('button', { name: /step 1/i });
      fireEvent.click(step1Button);

      // Should not throw error
      expect(step1Button).toBeInTheDocument();
    });
  });

  describe('Integration tests', () => {
    it('should work correctly in a multi-step form scenario', () => {
      const onStepClick = vi.fn();
      const { rerender } = render(
        <StepIndicator
          steps={mockSteps}
          currentStep={0}
          allowNavigation={true}
          onStepClick={onStepClick}
        />
      );

      // Step 1 is current
      expect(screen.getByRole('button', { name: /step 1/i })).toHaveAttribute('aria-current', 'step');

      // Progress to step 2
      rerender(
        <StepIndicator
          steps={mockSteps}
          currentStep={1}
          allowNavigation={true}
          onStepClick={onStepClick}
        />
      );

      // Step 1 is completed, step 2 is current
      const step1Button = screen.getByRole('button', { name: /step 1/i });
      expect(step1Button).not.toHaveAttribute('aria-current');

      const step2Button = screen.getByRole('button', { name: /step 2/i });
      expect(step2Button).toHaveAttribute('aria-current', 'step');

      // Can navigate back to step 1
      fireEvent.click(step1Button);
      expect(onStepClick).toHaveBeenCalledWith(0);
    });

    it('should combine variant, size, and navigation correctly', async () => {
      const user = userEvent.setup();
      const onStepClick = vi.fn();

      const { container } = render(
        <StepIndicator
          steps={mockSteps}
          currentStep={2}
          variant="vertical"
          size="lg"
          allowNavigation={true}
          onStepClick={onStepClick}
        />
      );

      // Check size
      const circles = container.querySelectorAll('.h-10.w-10');
      expect(circles.length).toBeGreaterThan(0);

      // Check variant
      const stepper = container.querySelector('.flex-col');
      expect(stepper).toBeInTheDocument();

      // Check navigation
      const buttons = screen.getAllByRole('button');
      const step1Button = buttons.find(btn => btn.getAttribute('aria-label')?.includes('Step 1'));
      expect(step1Button).toBeDefined();

      step1Button!.focus();
      await user.keyboard('{ArrowDown}');

      expect(onStepClick).toHaveBeenCalledWith(1);
    });
  });
});
