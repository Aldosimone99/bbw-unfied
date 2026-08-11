"use client";

import { useEffect, useRef } from "react";
import styles from "./LandingClient.module.css";

type LandingClientProps = {
  html: string;
};

const lightHeaderLogoSrc = "/images/brand/logo-flat-dark-bronze.png";
const darkHeaderLogoSrc = "/images/brand/icon-flat.png";

export default function LandingClient({ html }: LandingClientProps) {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const header = document.getElementById("siteHeader");
    const snapContainer = document.getElementById("landingSnap");
    const menuButton = document.getElementById("menuButton");
    const nav = document.getElementById("siteNav");
    const brandLogo = document.getElementById("brandLogo");
    const revealItems = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const heroButtons = Array.from(document.querySelectorAll<HTMLElement>(".heroButton"));
    const mobileSliderSections = Array.from(document.querySelectorAll<HTMLElement>("#specialisti, .specializedNetwork"));
    const darkSections = ["fiducia", "cta-footer"]
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const mobileNavQuery = window.matchMedia("(max-width: 980px)");

    const updateBrandLogo = () => {
      if (!header || !brandLogo) return;

      const nextSrc = header.classList.contains("navbar--transparent") && !header.classList.contains("is-open")
        ? darkHeaderLogoSrc
        : lightHeaderLogoSrc;

      if (brandLogo.getAttribute("src") !== nextSrc) {
        brandLogo.setAttribute("src", nextSrc);
      }
    };

    const updateHeader = () => {
      if (!header) return;
      const isNestedScroller = Boolean(
        snapContainer
        && getComputedStyle(snapContainer).overflowY !== "visible"
        && snapContainer.scrollHeight > snapContainer.clientHeight,
      );
      const scrollTop = isNestedScroller ? snapContainer?.scrollTop ?? 0 : window.scrollY;
      const viewportHeight = isNestedScroller ? snapContainer?.clientHeight ?? window.innerHeight : window.innerHeight;
      const viewportProbe = scrollTop + viewportHeight * 0.28;
      const isDarkSection = darkSections.some((section) => {
        const sectionTop = section.offsetTop;
        const sectionBottom = sectionTop + section.offsetHeight;
        return viewportProbe >= sectionTop && viewportProbe < sectionBottom;
      });

      header.classList.toggle("navbar--transparent", isDarkSection);
      header.classList.toggle("navbar--solid", mobileNavQuery.matches && !isDarkSection);
      header.classList.toggle("is-scrolled", mobileNavQuery.matches ? !isDarkSection : scrollTop > 18 && !isDarkSection);
      updateBrandLogo();
    };

    const closeMenu = () => {
      if (!header || !menuButton) return;
      document.body.classList.remove("menu-open");
      header.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
      updateHeader();
    };

    const toggleMenu = () => {
      if (!header || !menuButton) return;
      const isOpen = header.classList.toggle("is-open");
      document.body.classList.toggle("menu-open", isOpen);
      menuButton.setAttribute("aria-expanded", String(isOpen));
      if (!isOpen) updateHeader();
      else updateBrandLogo();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      heroButtons.forEach((button) => {
        const shape = button.querySelector<HTMLElement>(".heroButtonShape");
        if (!shape) return;

        const rect = button.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const deltaX = event.clientX - centerX;
        const deltaY = event.clientY - centerY;
        const influence = Math.max(0, 1 - Math.hypot(deltaX, deltaY) / 220);
        const x = Math.max(-8, Math.min(8, deltaX * 0.04 * influence));
        const y = Math.max(-8, Math.min(8, deltaY * 0.04 * influence));

        shape.style.transform = `translate(${x}px, ${y}px)`;
      });
    };

    const resetButtonShapes = () => {
      heroButtons.forEach((button) => {
        const shape = button.querySelector<HTMLElement>(".heroButtonShape");
        if (shape) shape.style.transform = "";
      });
    };

    const createMobileCardSlider = (section: HTMLElement) => {
      const viewport = section.querySelector<HTMLElement>(".portraitWall");
      const cards = Array.from(viewport?.querySelectorAll<HTMLElement>(".portrait") || []);
      let dots: HTMLButtonElement[] = [];
      let dotsEl: HTMLDivElement | undefined;
      let track: HTMLDivElement | undefined;
      let activeIndex = 0;
      let touchStartX = 0;
      let pointerStartX = 0;
      let isPointerDragging = false;
      let wheelLocked = false;
      let mounted = false;

      const setActive = (nextIndex: number) => {
        if (!track || dots.length === 0) return;

        activeIndex = Math.max(0, Math.min(cards.length - 1, nextIndex));
        if (viewport) viewport.scrollLeft = 0;
        track.style.transform = `translateX(-${activeIndex * 100}%)`;
        dots.forEach((dot, index) => {
          const isActive = index === activeIndex;
          dot.classList.toggle("is-active", isActive);
          dot.setAttribute("aria-selected", String(isActive));
        });
      };

      const handleTouchStart = (event: TouchEvent) => {
        touchStartX = event.changedTouches[0]?.clientX ?? 0;
      };

      const handleTouchEnd = (event: TouchEvent) => {
        const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
        const deltaX = touchEndX - touchStartX;

        if (deltaX < -40) setActive(activeIndex + 1);
        if (deltaX > 40) setActive(activeIndex - 1);
      };

      const handlePointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        pointerStartX = event.clientX;
        isPointerDragging = true;
        viewport?.setPointerCapture?.(event.pointerId);
        viewport?.classList.add("is-dragging");
      };

      const handlePointerUp = (event: PointerEvent) => {
        if (!isPointerDragging) return;

        const deltaX = event.clientX - pointerStartX;
        isPointerDragging = false;
        viewport?.releasePointerCapture?.(event.pointerId);
        viewport?.classList.remove("is-dragging");

        if (deltaX < -40) setActive(activeIndex + 1);
        if (deltaX > 40) setActive(activeIndex - 1);
      };

      const handlePointerCancel = () => {
        isPointerDragging = false;
        viewport?.classList.remove("is-dragging");
      };

      const handleWheel = (event: WheelEvent) => {
        if (wheelLocked || Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 24) return;

        event.preventDefault();
        setActive(activeIndex + (event.deltaX > 0 ? 1 : -1));
        wheelLocked = true;
        window.setTimeout(() => {
          wheelLocked = false;
        }, 420);
      };

      const setup = () => {
        if (!viewport || cards.length <= 1 || mounted) return;

        viewport.scrollLeft = 0;
        section.classList.add("is-mobile-card-slider");
        viewport.classList.add("mobile-specialists-viewport");
        track = document.createElement("div");
        track.className = "mobile-specialists-track";
        cards.forEach((card) => {
          card.classList.add("mobile-specialist-card");
        const inner = document.createElement("div");
        const imageShell = document.createElement("div");
        const image = card.querySelector<HTMLImageElement>(":scope > img");
        const info = card.querySelector<HTMLElement>(":scope > .portraitInfo");
        const name = info?.querySelector<HTMLElement>("h3");
        const role = info?.querySelector<HTMLElement>(".portraitRole");
        const badge = info?.querySelector<HTMLElement>(".portraitBadge");

        inner.className = "mobile-specialist-card-inner";
        imageShell.className = "mobile-specialist-card-image";
        info?.classList.add("mobile-specialist-card-content");
        name?.classList.add("mobile-specialist-name");
        role?.classList.add("mobile-specialist-role");
        badge?.classList.add("mobile-specialist-verified");

        if (image) {
          image.draggable = false;
          imageShell.append(image);
          inner.append(imageShell);
        }

        Array.from(card.childNodes).forEach((node) => {
          inner.append(node);
        });

        card.append(inner);
          track?.append(card);
      });
        viewport.append(track);

        dotsEl = document.createElement("div");
        dotsEl.className = "mobile-specialists-dots";
        dotsEl.setAttribute("role", "tablist");
        dotsEl.setAttribute("aria-label", "Professionisti");

        dots = cards.map((_, index) => {
        const dot = document.createElement("button");
        dot.className = "mobile-specialists-dot";
        dot.type = "button";
        dot.setAttribute("role", "tab");
        dot.setAttribute("aria-label", `Vai al professionista ${index + 1}`);
          dot.addEventListener("click", () => setActive(index));
          dotsEl?.append(dot);
        return dot;
      });

        viewport.insertAdjacentElement("afterend", dotsEl);
        viewport.addEventListener("touchstart", handleTouchStart, { passive: true });
        viewport.addEventListener("touchend", handleTouchEnd, { passive: true });
        viewport.addEventListener("pointerdown", handlePointerDown);
        viewport.addEventListener("pointerup", handlePointerUp);
        viewport.addEventListener("pointercancel", handlePointerCancel);
        viewport.addEventListener("lostpointercapture", handlePointerCancel);
        viewport.addEventListener("wheel", handleWheel, { passive: false });
        mounted = true;
        setActive(0);
      };

      const teardown = () => {
        if (!viewport || !track || !mounted) return;

        viewport.removeEventListener("touchstart", handleTouchStart);
        viewport.removeEventListener("touchend", handleTouchEnd);
        viewport.removeEventListener("pointerdown", handlePointerDown);
        viewport.removeEventListener("pointerup", handlePointerUp);
        viewport.removeEventListener("pointercancel", handlePointerCancel);
        viewport.removeEventListener("lostpointercapture", handlePointerCancel);
        viewport.removeEventListener("wheel", handleWheel);
        dotsEl?.remove();
        dots = [];
        dotsEl = undefined;

        cards.forEach((card) => {
        const inner = card.querySelector<HTMLElement>(":scope > .mobile-specialist-card-inner");
        const imageShell = inner?.querySelector<HTMLElement>(":scope > .mobile-specialist-card-image");
        const image = imageShell?.querySelector<HTMLImageElement>("img");
        const info = inner?.querySelector<HTMLElement>(".portraitInfo");
        const name = info?.querySelector<HTMLElement>("h3");
        const role = info?.querySelector<HTMLElement>(".portraitRole");
        const badge = info?.querySelector<HTMLElement>(".portraitBadge");

        if (image && inner && imageShell) {
          inner.insertBefore(image, imageShell);
          imageShell.remove();
        }

        if (inner) {
          Array.from(inner.childNodes).forEach((node) => {
            card.append(node);
          });
          inner.remove();
        }

        info?.classList.remove("mobile-specialist-card-content");
        name?.classList.remove("mobile-specialist-name");
        role?.classList.remove("mobile-specialist-role");
        badge?.classList.remove("mobile-specialist-verified");
        card.classList.remove("mobile-specialist-card");
          viewport.append(card);
      });

        track.remove();
        track = undefined;
        viewport.classList.remove("mobile-specialists-viewport", "is-dragging");
        section.classList.remove("is-mobile-card-slider");
        activeIndex = 0;
        mounted = false;
    };

      return {
        sync: () => {
          if (mobileNavQuery.matches) setup();
          else teardown();
        },
        refresh: () => setActive(activeIndex),
        destroy: teardown,
      };
    };

    const mobileCardSliders = mobileSliderSections.map(createMobileCardSlider);

    const handleMobileNavChange = () => {
      mobileCardSliders.forEach((slider) => slider.sync());
      updateHeader();
    };

    const handleMobileSliderResize = () => {
      mobileCardSliders.forEach((slider) => slider.refresh());
    };

    mobileCardSliders.forEach((slider) => slider.sync());

    updateHeader();
    snapContainer?.addEventListener("scroll", updateHeader, { passive: true });
    window.addEventListener("scroll", updateHeader, { passive: true });
    window.addEventListener("load", updateHeader, { passive: true });
    window.addEventListener("resize", handleMobileSliderResize, { passive: true });
    mobileNavQuery.addEventListener("change", handleMobileNavChange);
    menuButton?.addEventListener("click", toggleMenu);
    nav?.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeMenu);
    });
    document.addEventListener("keydown", handleEscape);

    let revealObserver: IntersectionObserver | undefined;
    if (!reduceMotion && "IntersectionObserver" in window) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver?.unobserve(entry.target);
        });
      }, { threshold: 0.14 });

      revealItems.forEach((item) => revealObserver?.observe(item));
    } else {
      revealItems.forEach((item) => item.classList.add("is-visible"));
    }

    if (reduceMotion || coarsePointer) {
      document.querySelectorAll(".heroButtonMorph").forEach((morph) => morph.remove());
    } else {
      document.addEventListener("pointermove", handlePointerMove, { passive: true });
      document.addEventListener("pointerleave", resetButtonShapes, { passive: true });
      window.addEventListener("blur", resetButtonShapes);
    }

    return () => {
      snapContainer?.removeEventListener("scroll", updateHeader);
      window.removeEventListener("scroll", updateHeader);
      window.removeEventListener("load", updateHeader);
      window.removeEventListener("resize", handleMobileSliderResize);
      mobileNavQuery.removeEventListener("change", handleMobileNavChange);
      menuButton?.removeEventListener("click", toggleMenu);
      nav?.querySelectorAll("a").forEach((link) => {
        link.removeEventListener("click", closeMenu);
      });
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerleave", resetButtonShapes);
      window.removeEventListener("blur", resetButtonShapes);
      revealObserver?.disconnect();
      mobileCardSliders.forEach((slider) => slider.destroy());
      document.body.classList.remove("menu-open");
    };
  }, []);

  return <div className={styles.shell} dangerouslySetInnerHTML={{ __html: html }} />;
}
