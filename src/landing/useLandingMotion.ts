import { useEffect } from "react"
import { LANDING_MOTION } from "./motionConfig"

/** GSAP owns only presentation transforms; all timings and angles are tuned here. */
export function useLandingMotion(enabled: boolean) {
  useEffect(() => {
    if (
      !enabled ||
      !LANDING_MOTION.gsap ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return
    let disposed = false
    let cleanup: (() => void) | undefined

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([gsapModule, scrollModule]) => {
        if (disposed) return
        const gsap = gsapModule.gsap
        const ScrollTrigger = scrollModule.ScrollTrigger
        gsap.registerPlugin(ScrollTrigger)
        const root = document.querySelector<HTMLElement>(".landing-page")
        const hero = root?.querySelector<HTMLElement>(".landing-hero")
        const card = root?.querySelector<HTMLElement>(".preview-window")
        if (!root || !hero || !card) return
        // Keep the default stylesheet fully readable; opt into hidden entrance states only
        // after GSAP is loaded and this motion hook has successfully initialized.
        root.classList.add("js-motion")
        const desktopMotion = window.matchMedia("(min-width: 768px)").matches

        const listenerCleanup: Array<() => void> = []
        const revealSafely = () => root.classList.add("motion-safe-revealed")
        const safetyTimer = window.setTimeout(revealSafely, 3000)
        const onBeforePrint = () => revealSafely()
        const onVisibilityChange = () => {
          if (document.visibilityState === "visible") revealSafely()
        }
        window.addEventListener("beforeprint", onBeforePrint)
        document.addEventListener("visibilitychange", onVisibilityChange)
        listenerCleanup.push(() => {
          window.clearTimeout(safetyTimer)
          window.removeEventListener("beforeprint", onBeforePrint)
          document.removeEventListener("visibilitychange", onVisibilityChange)
        })

        const refreshTriggers = () => { if (!disposed) ScrollTrigger.refresh() }
        const refreshFrame = requestAnimationFrame(refreshTriggers)
        if (document.fonts?.ready) void document.fonts.ready.then(refreshTriggers)
        root.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
          if (image.complete) return
          const refreshImage = () => refreshTriggers()
          image.addEventListener("load", refreshImage, { once: true })
          image.addEventListener("error", refreshImage, { once: true })
          listenerCleanup.push(() => {
            image.removeEventListener("load", refreshImage)
            image.removeEventListener("error", refreshImage)
          })
        })
        if (window.location.hash) {
          let targetId = window.location.hash.slice(1)
          try { targetId = decodeURIComponent(targetId) } catch { /* malformed hash: keep raw id */ }
          const target = document.getElementById(targetId)
          if (target && root.contains(target)) {
            revealSafely()
            requestAnimationFrame(() => target.scrollIntoView({ block: "start", behavior: "auto" }))
          }
        }
        const understand = root.querySelector<HTMLElement>(".hero-understand")
        const context = gsap.context(
          () => {
            const intro = gsap.timeline({ defaults: { ease: "power3.out" } })
            intro
              .fromTo(".landing-nav", { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.34 })
              .fromTo(
                ".landing-kicker",
                { autoAlpha: 0, y: 9 },
                { autoAlpha: 1, y: 0, duration: 0.26 },
                "-=0.18",
              )
              .fromTo(
                ".hero-line",
                {
                  autoAlpha: 0,
                  y: 22,
                  clipPath: "inset(0 0 100% 0)",
                },
                {
                  autoAlpha: 1,
                  y: 0,
                  clipPath: "inset(0 0 0% 0)",
                  duration: 0.42,
                  stagger: 0.12,
                },
                "-=0.12",
              )
              .fromTo(
                ".landing-description",
                { autoAlpha: 0, y: 10 },
                { autoAlpha: 1, y: 0, duration: 0.3 },
                "-=0.18",
              )
              .fromTo(
                ".landing-actions > *",
                { autoAlpha: 0, y: 8 },
                { autoAlpha: 1, y: 0, duration: 0.25, stagger: 0.07 },
                "-=0.16",
              )
              .fromTo(
                ".landing-assurance",
                { autoAlpha: 0, y: 7 },
                { autoAlpha: 1, y: 0, duration: 0.25 },
                "-=0.12",
              )
              .fromTo(
                ".landing-visual",
                { autoAlpha: 0, y: 18 },
                { autoAlpha: 1, y: 0, duration: 0.48 },
                "-=0.42",
              )

            // One quiet left-to-right highlight, then restore the exact resting accent color.
            if (understand) {
              intro.call(
                () => understand.classList.add("light-sweep"),
                [],
                0.86,
              )
              intro.fromTo(
                understand,
                { backgroundPosition: "140% 0" },
                {
                  backgroundPosition: "-40% 0",
                  duration: 0.62,
                  ease: "sine.inOut",
                  onComplete: () => understand.classList.remove("light-sweep"),
                },
                0.86,
              )
            }

            if (desktopMotion)
              gsap.set(card, {
                transformPerspective: 1000,
                rotationY: -2,
                rotationX: 0.5,
                transformOrigin: "50% 50%",
              })
            gsap.to(card, {
              y: -5,
              duration: 4.8,
              repeat: -1,
              yoyo: true,
              ease: "sine.inOut",
              delay: 1.45,
            })

            const signals = gsap.utils.toArray<HTMLElement>(".preview-signal")
            const previewSequence = gsap.timeline({ delay: 1.45 })
            signals.forEach((signal) => {
              previewSequence
                .call(() => signal.classList.add("motion-highlight"))
                // Let CSS choose the colors so the same one-shot effect follows
                // the active theme instead of leaving dark inline colors behind.
                .to(signal, { y: -1, duration: 0.18, ease: "power1.out" }, "<")
                .to(signal, { y: 0, duration: 0.18, ease: "power1.inOut" }, "+=0.32")
                .call(() => signal.classList.remove("motion-highlight"))
            })
            previewSequence
              .fromTo(".evidence-copy", { clipPath: "inset(0 100% 0 0)" }, {
                clipPath: "inset(0 0% 0 0)",
                duration: 0.58,
                ease: "power2.out",
              })
              .from(
                ".preview-foot span",
                { autoAlpha: 0, y: 4, duration: 0.22, stagger: 0.12 },
                "-=0.05",
              )

            gsap.fromTo(".landing-rule", { autoAlpha: 0, y: 8 }, {
              autoAlpha: 1,
              y: 0,
              duration: 0.5,
              scrollTrigger: {
                trigger: ".landing-rule",
                start: "top 92%",
                once: true,
              },
            })
            gsap.from(".landing-rule > span", {
              scaleX: 0,
              duration: 0.7,
              stagger: 0.1,
              transformOrigin: "left center",
              scrollTrigger: {
                trigger: ".landing-rule",
                start: "top 92%",
                once: true,
              },
            })
            gsap.fromTo(".landing-features article", { autoAlpha: 0, y: 18 }, {
              autoAlpha: 1,
              y: 0,
              duration: 0.52,
              stagger: 0.13,
              scrollTrigger: {
                trigger: ".landing-features",
                start: "top 92%",
                once: true,
              },
            })
            gsap.fromTo(".landing-steps article", { autoAlpha: 0, y: 16 }, {
              autoAlpha: 1,
              y: 0,
              duration: 0.48,
              stagger: 0.1,
              scrollTrigger: {
                trigger: ".landing-steps",
                start: "top 92%",
                once: true,
              },
            })
            gsap.fromTo(".triage-card", { autoAlpha: 0, y: 18 }, {
              autoAlpha: 1,
              y: 0,
              duration: 0.46,
              stagger: 0.12,
              scrollTrigger: {
                trigger: ".triage-grid",
                start: "top 92%",
                once: true,
              },
            })
            gsap.fromTo(".trust-card", { autoAlpha: 0, y: 14 }, {
              autoAlpha: 1,
              y: 0,
              duration: 0.42,
              stagger: 0.09,
              scrollTrigger: {
                trigger: ".trust-card-grid",
                start: "top 92%",
                once: true,
              },
            })
            const diagramPaths = gsap.utils.toArray<SVGPathElement>(
              ".evidence-flow-svg .flow-path",
            )
            diagramPaths.forEach((path) => {
              const length = path.getTotalLength()
              gsap.set(path, { strokeDasharray: length, strokeDashoffset: length })
            })
            const flow = gsap.timeline({
              scrollTrigger: {
                trigger: ".trust-diagram-wrap",
                start: "top 92%",
                once: true,
              },
            })
            flow.to(".flow-main", { strokeDashoffset: 0, duration: 0.5, ease: "power1.out" })
              .to(".flow-accepted", { strokeDashoffset: 0, duration: 0.48, ease: "power1.out" })
              .to(".flow-dropped", { strokeDashoffset: 0, duration: 0.48, ease: "power1.out" })
              .fromTo(".flow-node.dropped", { autoAlpha: 0.25 }, { autoAlpha: 0.72, duration: 0.34 }, "<")
            gsap.fromTo(".local-points li", { autoAlpha: 0, y: 10 }, {
              autoAlpha: 1,
              y: 0,
              duration: 0.36,
              stagger: 0.08,
              scrollTrigger: {
                trigger: ".local-points",
                start: "top 92%",
                once: true,
              },
            })
            gsap.fromTo(
              ".status-chip",
              { scale: 1 },
              {
                scale: 1.035,
                duration: 0.42,
                repeat: 1,
                yoyo: true,
                ease: "sine.inOut",
                scrollTrigger: {
                  trigger: ".local-status-card",
                  start: "top 92%",
                  once: true,
                },
              },
            )
            gsap.fromTo(".landing-faq-list details", { autoAlpha: 0, y: 12 }, {
              autoAlpha: 1,
              y: 0,
              duration: 0.42,
              stagger: 0.08,
              scrollTrigger: {
                trigger: ".landing-faq-list",
                start: "top 92%",
                once: true,
              },
            })
            gsap.fromTo(".landing-close", { autoAlpha: 0, y: 14 }, {
              autoAlpha: 1,
              y: 0,
              duration: 0.5,
              scrollTrigger: {
                trigger: ".landing-close",
                start: "top 92%",
                once: true,
              },
            })

            // The scene is an enhancement; fade it as the user leaves the hero, with no pinning.
            gsap.to(".landing-hero .prism-scene", {
              autoAlpha: 0,
              rotate: 4,
              scrollTrigger: {
                trigger: hero,
                start: "top top",
                end: "bottom top",
                scrub: 0.8,
              },
            })

            // Magnetic movement is capped at six pixels and reset smoothly on pointer leave.
            root
              .querySelectorAll<HTMLElement>(
                ".landing-nav-cta, .landing-primary",
              )
              .forEach((button) => {
                const xTo = gsap.quickTo(button, "x", {
                  duration: 0.35,
                  ease: "power3.out",
                })
                const yTo = gsap.quickTo(button, "y", {
                  duration: 0.35,
                  ease: "power3.out",
                })
                const arrow = button.querySelector("svg")
                const arrowTo = arrow
                  ? gsap.quickTo(arrow, "x", {
                      duration: 0.35,
                      ease: "power3.out",
                    })
                  : undefined
                const move = (event: PointerEvent) => {
                  const bounds = button.getBoundingClientRect()
                  xTo(
                    Math.max(
                      -6,
                      Math.min(
                        6,
                        (event.clientX - bounds.left - bounds.width / 2) * 0.12,
                      ),
                    ),
                  )
                  yTo(
                    Math.max(
                      -6,
                      Math.min(
                        6,
                        (event.clientY - bounds.top - bounds.height / 2) * 0.12,
                      ),
                    ),
                  )
                  arrowTo?.(3)
                }
                const reset = () => {
                  xTo(0)
                  yTo(0)
                  arrowTo?.(0)
                }
                button.addEventListener("pointermove", move)
                button.addEventListener("pointerleave", reset)
                listenerCleanup.push(() => {
                  button.removeEventListener("pointermove", move)
                  button.removeEventListener("pointerleave", reset)
                })
              })

            if (desktopMotion) {
              const xTo = gsap.quickTo(card, "rotationY", {
                duration: 0.5,
                ease: "power3.out",
              })
              const yTo = gsap.quickTo(card, "rotationX", {
                duration: 0.5,
                ease: "power3.out",
              })
              const tilt = (event: PointerEvent) => {
                const bounds = card.getBoundingClientRect()
                const dx = (event.clientX - bounds.left) / bounds.width - 0.5
                const dy = (event.clientY - bounds.top) / bounds.height - 0.5
                xTo(-2 + Math.max(-2, Math.min(2, dx * 4)))
                yTo(0.5 - Math.max(-2, Math.min(2, dy * 4)))
              }
              const resetTilt = () => {
                xTo(-2)
                yTo(0.5)
              }
              card.addEventListener("pointermove", tilt)
              card.addEventListener("pointerleave", resetTilt)
              listenerCleanup.push(() => {
                card.removeEventListener("pointermove", tilt)
                card.removeEventListener("pointerleave", resetTilt)
              })
            }
          },
          root,
        )
        cleanup = () => {
          context.revert()
          listenerCleanup.forEach((remove) => remove())
          cancelAnimationFrame(refreshFrame)
          root.classList.remove("js-motion", "motion-safe-revealed")
          understand?.classList.remove("light-sweep")
          root
            .querySelectorAll(".motion-highlight")
            .forEach((node) => node.classList.remove("motion-highlight"))
        }
      })
      .catch(() => {
        // Motion is optional: a failed dynamic import must never affect the landing page.
        document.querySelector(".landing-page")?.classList.remove("js-motion", "motion-safe-revealed")
      })

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [enabled])
}
