// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import LandingPage from "../src/LandingPage"
import { BrowserRouter } from "../src/router"
import { ThemeProvider } from "../src/theme"

vi.mock("../src/landing/motionConfig", () => ({ LANDING_MOTION: { three: false, gsap: false } }))

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})

afterEach(cleanup)

function renderLanding() {
  render(<ThemeProvider><BrowserRouter><LandingPage /></BrowserRouter></ThemeProvider>)
  return screen.getByRole("button", { name: "Open menu" })
}

describe("compact landing navigation", () => {
  it("opens and closes the menu from the toggle button", () => {
    const toggle = renderLanding()
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(toggle).toHaveAttribute("aria-controls", "landing-menu")
    fireEvent.click(toggle)
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true")
    expect(document.querySelector(".landing-nav")).toHaveClass("menu-open")
    fireEvent.click(screen.getByRole("button", { name: "Close menu" }))
    expect(document.querySelector(".landing-nav")).not.toHaveClass("menu-open")
  })

  it("closes after choosing a link, on Escape, and on an outside tap", () => {
    const toggle = renderLanding()
    const menu = screen.getByRole("navigation", { name: "Main navigation" })

    fireEvent.click(toggle)
    fireEvent.click(menu.querySelector('a[href="#faq"]')!)
    expect(toggle).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(toggle)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(toggle)
    fireEvent.pointerDown(document.querySelector(".landing-hero")!)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
  })
})
