import React, { useEffect, useRef, useState } from 'react'
import SEO from '../components/SEO'
import Particles from '../components/Particles'
import GlassIcons from '../components/GlassIcons'
import GlassSurface from '../components/GlassSurface'
import MetallicPaint from '../components/MetallicPaint'
import CardSwap, { Card } from '../components/CardSwap'
import BounceCards from '../components/BounceCards'
import MagicBento from '../components/MagicBento'
import './Adrian.css'

// ── SVG title for MetallicPaint ───────────────────────────────────────────────
const ADRIAN_SVG = (() => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 190" width="820" height="190"><rect width="820" height="190" fill="white"/><text x="410" y="148" font-family="Arial Black,Impact,sans-serif" font-size="118" font-weight="900" fill="black" text-anchor="middle" letter-spacing="6">ADRIAN</text></svg>'
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
})()

// ── Skill card images ─────────────────────────────────────────────────────────
const makeSkillCard = (bg: string, icon: string, label: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><rect width="200" height="200" fill="${bg}"/><text x="100" y="95" font-family="Arial" font-size="52" text-anchor="middle">${icon}</text><text x="100" y="148" font-family="Arial Black,sans-serif" font-size="17" font-weight="900" fill="rgba(255,255,255,0.9)" text-anchor="middle">${label}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const SKILL_IMAGES = [
  makeSkillCard('#0a1628', '\uD83C\uDFB5', 'Music'),
  makeSkillCard('#12082a', '\u26A1', 'Dev'),
  makeSkillCard('#0a1a12', '\uD83C\uDFAE', 'Games'),
  makeSkillCard('#1a100a', '\uD83D\uDD27', 'Hardware'),
  makeSkillCard('#0e0a1a', '\uD83C\uDFA8', 'Design'),
]

// ── Social platform SVG icons ─────────────────────────────────────────────────
const YouTubeIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
const SpotifyIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
const InstagramIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
const LinkedInIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
const GitHubIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
const LastFmIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M10.584 17.21l-.88-2.392s-1.43 1.596-3.573 1.596c-1.897 0-3.244-1.648-3.244-4.288 0-3.385 1.706-4.59 3.38-4.59 2.41 0 3.178 1.565 3.837 3.573l.88 2.392c.879 2.667 2.52 4.81 7.274 4.81 3.407 0 5.71-1.044 5.71-3.793 0-2.227-1.27-3.374-3.626-3.924l-1.752-.384c-1.209-.274-1.565-.769-1.565-1.593 0-.934.734-1.484 1.939-1.484 1.319 0 2.03.494 2.14 1.676l2.749-.33c-.22-2.474-1.94-3.49-4.75-3.49-2.485 0-4.809.934-4.809 3.931 0 1.868.907 3.051 3.189 3.601l1.863.44c1.374.328 1.863.879 1.863 1.786 0 1.044-.99 1.483-2.803 1.483-2.723 0-3.849-1.428-4.508-3.381l-.902-2.611C12.327 7.69 10.474 6.097 7.255 6.097 3.547 6.097 0 8.315 0 12.181c0 3.711 2.09 6.26 5.987 6.26 3.107 0 4.597-1.23 4.597-1.23z"/></svg>
const RobloxIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M4.597 0L0 19.417 19.403 24 24 4.583zM15.17 17.3l-8.653-2.142 2.139-8.646 8.652 2.139z"/></svg>
const DiscordIcon = () => <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>

const SOCIAL_ITEMS = [
  { icon: <YouTubeIcon />,   color: 'red',    label: 'YouTube',   href: 'https://www.youtube.com/@agamez123' },
  { icon: <SpotifyIcon />,   color: 'green',  label: 'Spotify',   href: 'https://open.spotify.com/user/realagamez123' },
  { icon: <LastFmIcon />,    color: 'red',    label: 'Last.fm',   href: 'https://www.last.fm/user/agamez123' },
  { icon: <GitHubIcon />,    color: 'white',  label: 'GitHub',    href: 'https://github.com/ThatAdrian' },
  { icon: <LinkedInIcon />,  color: 'blue',   label: 'LinkedIn',  href: 'https://www.linkedin.com/in/adrian-dabrowski-379727251/' },
  { icon: <InstagramIcon />, color: 'pink',   label: 'Instagram', href: 'https://www.instagram.com/thatadrian_' },
  { icon: <DiscordIcon />,   color: 'indigo', label: 'Discord',   href: 'https://discord.com/users/agamez123' },
  { icon: <RobloxIcon />,    color: 'orange', label: 'Roblox',    href: 'https://www.roblox.com/users/search?keyword=agamez123' },
]

// ── Skill groups ──────────────────────────────────────────────────────────────
const SKILL_GROUPS = [
  { label: 'Music Production', color: '#00f5ff', skills: ['Ableton Live', 'FL Studio', 'Logic Pro', 'Sound Design', 'Mixing', 'Beatmaking', 'Composition', 'Vocals'] },
  { label: 'Development',      color: '#b400ff', skills: ['React', 'TypeScript', 'Vite', 'Supabase', 'HTML & CSS', 'Python', 'Git & GitHub'] },
  { label: 'Creative Tools',   color: '#ff6b35', skills: ['Photoshop', 'GIMP', 'Figma', 'DaVinci Resolve', 'Adobe Premiere', 'Sony Vegas'] },
  { label: 'Game Development', color: '#00ff88', skills: ['Roblox Studio', 'Unity', 'Game Design', 'Level Design', 'Project Management'] },
  { label: 'Professional',     color: '#ffd700', skills: ['EV Charging Systems', 'Technical Documentation', 'Customer Support', 'IT Support', 'DraftSight', 'Training'] },
  { label: 'Hardware',         color: '#ff4466', skills: ['Device Repair & Modding', 'Soldering & Electronics', 'PC Building', 'Hardware Tinkering'] },
]

// ── Interests ─────────────────────────────────────────────────────────────────
const INTERESTS = [
  { title: 'Music & Art',        description: 'Always listening, always creating', label: 'Core',     emoji: '🎵', color: '#080514' },
  { title: 'Skating',            description: 'Any kind, any surface',              label: 'Sport',    emoji: '🛹', color: '#060d0a' },
  { title: 'Gaming',             description: 'PC, console, and building my own',   label: 'Hobby',    emoji: '🎮', color: '#06050f' },
  { title: 'Collecting',         description: 'Things worth keeping',               label: 'Habit',    emoji: '📦', color: '#0d0806' },
  { title: 'Concerts',           description: 'Live music is another level',        label: 'Culture',  emoji: '🎤', color: '#0a0610' },
  { title: 'Being Productive',   description: 'Always working on something new',    label: 'Drive',    emoji: '⚡', color: '#060a08' },
]

// ── Projects ──────────────────────────────────────────────────────────────────
const PROJECTS = [
  { title: 'TheAdrianBlog',    tag: 'Web · Live',       color: '#00f5ff', link: 'https://www.theadrianblog.com', description: 'Full-stack blog with music reviews, audio previews, community ratings, inline comments and a custom publishing dashboard. React, TypeScript, Vite, Supabase.' },
  { title: 'Super Sumo Derby', tag: 'Roblox Game',      color: '#b400ff', description: 'A vehicle derby game in Roblox Studio with a dealership system, vehicle tiers, Bucks/Robux purchases, custom garage UI and A-Chassis physics.' },
  { title: 'YouTube Channel',  tag: 'Content',          color: '#ff0000', description: 'Video production covering tech, gaming, music and lifestyle. Full production from scripting through to editing in DaVinci Resolve and Premiere.' },
  { title: 'Ableton Journey',  tag: 'Music Production', color: '#00ff88', description: 'Working through music production — composition, sound design, mixing, and beatmaking. Learning Ableton from scratch with a goal to release original music.' },
  { title: 'Car Restoration',  tag: 'Hands-on',         color: '#ffd700', description: 'Diagnosing and repairing my own car — learning mechanics, sourcing parts, doing as much of the work as possible myself.' },
]

// ── Reveal hook ───────────────────────────────────────────────────────────────
function useReveal(ref: React.RefObject<Element | null>) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.05 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return visible
}

function Section({ id, children, className = '' }: { id: string; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const visible = useReveal(ref)
  return (
    <section id={id} ref={ref} className={`ap-section ${className} ${visible ? 'ap-visible' : ''}`}>
      {children}
    </section>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Adrian() {
  const [activeProject, setActiveProject] = useState(0)
  const parallaxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => {
      if (parallaxRef.current) parallaxRef.current.style.transform = `translateY(${window.scrollY * 0.25}px)`
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="ap-page page-transition">
      <SEO title="Adrian" description="Adrian Dabrowski — EV Support Engineer, music producer, developer and creator." url="/adrian" />

      {/* ── Particles background (full page, fixed) ── */}
      <div className="adrian-particles">
        <Particles
          particleColors={['#00f5ff', '#b400ff', '#00ff88', '#ffffff']}
          particleCount={160}
          particleSpread={12}
          speed={0.07}
          particleBaseSize={80}
          alphaParticles={true}
          disableRotation={true}
          moveParticlesOnHover={true}
          particleHoverFactor={0.5}
          pixelRatio={1}
        />
      </div>

      <div ref={parallaxRef} className="ap-hero-gradient-bg" />

      {/* ── HERO ─────────────────────────────────── */}
      <section className="ap-hero ap-visible">
        <div className="ap-hero-content">
          {/* MetallicPaint title */}
          <div className="ap-metallic-wrap">
            <MetallicPaint
              imageSrc={ADRIAN_SVG}
              scale={3.5} speed={0.25} liquid={0.6} brightness={2.2}
              contrast={0.55} refraction={0.012} blur={0.012}
              tintColor="#00f5ff" lightColor="#ffffff" darkColor="#001a1a"
              waveAmplitude={0.9} noiseScale={0.45} chromaticSpread={2.5}
              distortion={0.8} contour={0.15}
            />
          </div>

          <div className="ap-hero-sub">
            <span className="ap-hero-surname">DABROWSKI</span>
            <span className="ap-hero-dot">·</span>
            <span className="ap-hero-role">EV Support Engineer & Creator</span>
          </div>

          <div className="ap-hero-meta">
            <span className="ap-hero-meta-item">📍 Essex, UK</span>
            <span className="ap-hero-meta-item">🇬🇧 English · 🇵🇱 Polish</span>
            <span className="ap-hero-meta-item">🏍 Car & Motorbike</span>
          </div>

          {/* Glass social icons — same as original Adrian page */}
          <GlassSurface width="100%" height="auto" borderRadius={20} brightness={20} opacity={0.8} blur={16}
            style={{ marginTop: '0.5rem', padding: '0.5rem 1rem' }}>
            <GlassIcons items={SOCIAL_ITEMS} className="adrian-icons" />
          </GlassSurface>
        </div>

        <div className="ap-scroll-hint">
          <span>scroll</span>
          <div className="ap-scroll-line" />
        </div>
      </section>

      {/* ── ABOUT ────────────────────────────────── */}
      <Section id="about" className="ap-about-section">
        <div className="ap-section-inner">
          <p className="ap-section-eyebrow">Who I am</p>
          <h2 className="ap-section-title">About me</h2>
          <div className="ap-about-grid">
            <GlassSurface width="100%" height="auto" borderRadius={16} brightness={12} opacity={0.65} blur={14}>
              <div className="ap-bio-card">
                <p>I'm Adrian — an EV Support Engineer based in Essex, working in the manufacturing of EV charging equipment and electrical components.</p>
                <p>Outside of work I make music, build things on the web, develop a Roblox game, shoot videos, and fix my car. I studied Computer Science and Electronics & Robotics in college — most of what I do now is self-taught.</p>
                <p>This site is one of those projects — built from scratch with React and TypeScript, with a custom dashboard, audio previews, community ratings, inline comments, and a lot more.</p>
              </div>
            </GlassSurface>

            <div className="ap-about-right">
              <div className="ap-about-tags">
                {['Self-taught', 'Music Producer', 'Game Dev', 'Tech Enthusiast', 'Content Creator', 'Hardware Tinkerer', 'Computer Science', 'Electronics & Robotics'].map(t => (
                  <span key={t} className="ap-about-tag">{t}</span>
                ))}
              </div>
              <div className="ap-stats-grid">
                {[
                  { value: '2+', label: 'Languages spoken' },
                  { value: '5+', label: 'Active projects' },
                  { value: '∞', label: 'Things to learn' },
                  { value: '1', label: 'Blog built from scratch' },
                ].map(s => (
                  <div key={s.label} className="ap-stat">
                    <span className="ap-stat-value">{s.value}</span>
                    <span className="ap-stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── SKILLS ───────────────────────────────── */}
      <Section id="skills" className="ap-skills-section">
        <div className="ap-section-inner">
          <p className="ap-section-eyebrow">What I work with</p>
          <h2 className="ap-section-title">Skills</h2>
          <BounceCards
            images={SKILL_IMAGES}
            containerWidth={460} containerHeight={220}
            animationDelay={0.3} animationStagger={0.07}
            transformStyles={[
              'rotate(8deg) translate(-160px)',
              'rotate(3deg) translate(-80px)',
              'rotate(-2deg)',
              'rotate(-8deg) translate(80px)',
              'rotate(4deg) translate(160px)',
            ]}
            enableHover={true}
          />
          <div className="ap-skill-groups">
            {SKILL_GROUPS.map(group => (
              <GlassSurface key={group.label} width="100%" height="auto" borderRadius={12} brightness={8} opacity={0.5} blur={10}>
                <div className="ap-skill-group">
                  <span className="ap-skill-group-label" style={{ color: group.color }}>{group.label}</span>
                  <div className="ap-skill-pills">
                    {group.skills.map(s => (
                      <span key={s} className="ap-tag" style={{ '--tag-color': group.color } as React.CSSProperties}>{s}</span>
                    ))}
                  </div>
                </div>
              </GlassSurface>
            ))}
          </div>
        </div>
      </Section>

      {/* ── PROJECTS ─────────────────────────────── */}
      <Section id="projects" className="ap-projects-section">
        <div className="ap-section-inner">
          <p className="ap-section-eyebrow">What I'm building</p>
          <h2 className="ap-section-title">Projects</h2>
          <div className="ap-projects-layout">
            <div className="ap-project-info">
              {PROJECTS.map((p, i) => (
                <div key={p.title} className={`ap-project-detail ${i === activeProject ? 'active' : ''}`}>
                  <GlassSurface width="100%" height="auto" borderRadius={16} brightness={10} opacity={0.6} blur={12}>
                    <div className="ap-project-card">
                      <div className="ap-project-header">
                        <h3 className="ap-project-title" style={{ color: p.color }}>{p.title}</h3>
                        <span className="ap-project-tag">{p.tag}</span>
                      </div>
                      <p className="ap-project-desc">{p.description}</p>
                      {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="ap-project-link" style={{ color: p.color }}>Visit site →</a>}
                    </div>
                  </GlassSurface>
                </div>
              ))}
            </div>
            <div className="ap-cardswap-wrap">
              <CardSwap width={280} height={340} cardDistance={45} verticalDistance={55}
                delay={4000} pauseOnHover={true} skewAmount={4} easing="elastic"
                onCardClick={setActiveProject}>
                {PROJECTS.map((p, i) => (
                  <Card key={p.title} style={{ padding: 0, overflow: 'hidden', background: '#080514', border: `1px solid ${p.color}30` }}>
                    <div className="ap-swap-card-inner" style={{ '--card-accent': p.color } as React.CSSProperties}>
                      <div className="ap-swap-card-top" style={{ background: `linear-gradient(135deg, ${p.color}18, transparent)` }}>
                        <span className="ap-swap-card-num" style={{ color: p.color }}>0{i + 1}</span>
                      </div>
                      <div className="ap-swap-card-body">
                        <h3 className="ap-swap-card-title">{p.title}</h3>
                        <span className="ap-swap-card-tag">{p.tag}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </CardSwap>
            </div>
          </div>
        </div>
      </Section>

      {/* ── INTERESTS ────────────────────────────── */}
      <Section id="interests" className="ap-interests-section">
        <div className="ap-section-inner">
          <p className="ap-section-eyebrow">Outside the work</p>
          <h2 className="ap-section-title">Interests</h2>
          <MagicBento cards={INTERESTS} glowColor="0, 245, 255"
            enableStars={true} enableSpotlight={true} enableBorderGlow={true}
            enableMagnetism={true} clickEffect={true} particleCount={6} />
        </div>
      </Section>
    </div>
  )
}
