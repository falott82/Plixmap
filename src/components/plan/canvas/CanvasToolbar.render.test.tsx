// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CanvasToolbar } from './CanvasToolbar';

// First jsdom render test for the plan canvas. Establishes the harness for
// decomposing CanvasStage/usePlanView against real render coverage.

afterEach(() => cleanup());

const t = (m: { it: string; en: string }) => m.en;

const baseProps = {
  t,
  panToolActive: false,
  onTogglePanTool: vi.fn(),
  handleZoomIn: vi.fn(),
  handleZoomOut: vi.fn(),
  onToggleViewsMenu: vi.fn(),
  hasDefaultView: true,
  onGoDefaultView: vi.fn(),
  onTogglePresentation: vi.fn(),
  presentationMode: false
};

describe('CanvasToolbar (jsdom render)', () => {
  it('renders pan/zoom/views/default/presentation controls', () => {
    render(<CanvasToolbar {...baseProps} />);
    expect(screen.getByTitle('Pan tool')).toBeTruthy();
    expect(screen.getByTitle('Zoom in')).toBeTruthy();
    expect(screen.getByTitle('Zoom out')).toBeTruthy();
    expect(screen.getByTitle('Saved views')).toBeTruthy();
    expect(screen.getByTitle('Go to default view')).toBeTruthy();
    // presentationMode=false → the toggle shows the "enter" title, not the "exit" one
    expect(screen.getByTitle('Presentation (P)')).toBeTruthy();
    expect(screen.queryByTitle('Exit presentation (Esc)')).toBeNull();
  });

  it('wires zoom + pan + presentation handlers', () => {
    const props = { ...baseProps, onTogglePanTool: vi.fn(), handleZoomIn: vi.fn(), handleZoomOut: vi.fn(), onTogglePresentation: vi.fn() };
    render(<CanvasToolbar {...props} />);
    fireEvent.click(screen.getByTitle('Pan tool'));
    fireEvent.click(screen.getByTitle('Zoom in'));
    fireEvent.click(screen.getByTitle('Zoom out'));
    fireEvent.click(screen.getByTitle('Presentation (P)'));
    expect(props.onTogglePanTool).toHaveBeenCalledTimes(1);
    expect(props.handleZoomIn).toHaveBeenCalledTimes(1);
    expect(props.handleZoomOut).toHaveBeenCalledTimes(1);
    expect(props.onTogglePresentation).toHaveBeenCalledTimes(1);
  });

  it('disables the default-view button when no default view exists', () => {
    const onGoDefaultView = vi.fn();
    render(<CanvasToolbar {...baseProps} hasDefaultView={false} onGoDefaultView={onGoDefaultView} />);
    const btn = screen.getByTitle('Set a default view first') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('omits the views button when no handler is provided', () => {
    render(<CanvasToolbar {...baseProps} onToggleViewsMenu={undefined} />);
    expect(screen.queryByTitle('Saved views')).toBeNull();
  });
});
