import React, { useEffect, useRef, useState } from 'react'
import MetallicPaint from '../components/MetallicPaint'
import CardSwap, { Card } from '../components/CardSwap'
import BounceCards from '../components/BounceCards'
import MagicBento from '../components/MagicBento'
import GlassSurface from '../components/GlassSurface'
import './Adrian.css'

// ── Generate SVG data URL for MetallicPaint title ─────────────────────────────
const makeSvgUrl = (text: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 190" width="820" height="190">
    <rect width="820" height="190" fill="white"/>
    <text x="410" y="148" font-family="Arial Black,Impact,sans-serif" font-size="118" font-weight="900" fill="black" text-anchor="middle" letter-spacing="6">${text}</text>
  </svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

const ADRIAN_SVG = makeSvgUrl('ADRIAN')

// ── Skill card images (coloured SVGs) ─────────────────────────────────────────
const makeSkillCard = (bg: string, emoji: string, label: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <rect width="200" height="200" fill="${bg}" rx="0"/>
    <text x="100" y="95" font-family="Arial" font-size="52" text-anchor="middle">${emoji}</text>
    <text x="100" y="148" font-family="Arial Black,sans-serif" font-size="17" font-weight="900" fill="rgba(255,255,255,0.9)" text-anchor="middle">${label}</text>
  </svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

const SKILL_IMAGES = [
  makeSkillCard('#0a1628', '🎵', 'Music'),
  makeSkillCard('#12082a', '⚡', 'Dev'),
  makeSkillCard('#0a1a12', '🎮', 'Games'),
  makeSkillCard('#1a100a', '🔧', 'Hardware'),
  makeSkillCard('#0e0a1a', '🎨', 'Design'),
]

// ── Skill data ─────────────────────────────────────────────────────────────────
const SKILL_GROUPS = [
  {
    label: 'Music Production',
    color: '#00f5ff',
    skills: ['Ableton Live', 'FL Studio', 'Logic Pro', 'Sound Design', 'Mixing', 'Beatmaking', 'Composition', 'Vocals & Lyrics'],
  },
  {
    label: 'Development',
    color: '#b400ff',
    skills: ['React', 'TypeScript', 'Vite', 'Supabase', 'HTML & CSS', 'Python', 'Git & GitHub'],
  },
  {
    label: 'Creative Tools',
    color: '#ff6b35',
    skills: ['Photoshop', 'GIMP', 'Figma', 'DaVinci Resolve', 'Adobe Premiere', 'Sony Vegas', 'Illustrator'],
  },
  {
    label: 'Game Development',
    color: '#00ff88',
    skills: ['Roblox Studio', 'Unity', 'Game Design', 'Level Design', 'Project Management', 'Scripting'],
  },
  {
    label: 'Professional',
    color: '#ffd700',
    skills: ['EV Charging Systems', 'Technical Documentation', 'Customer Support', 'IT Support', 'DraftSight', 'Training Sessions'],
  },
  {
    label: 'Hardware',
    color: '#ff4466',
    skills: ['Device Repair & Modding', 'Soldering & Electronics', 'PC Building', 'Building & Tinkering'],
  },
]

// ── Interests for MagicBento ──────────────────────────────────────────────────
const INTERESTS = [
  { title: 'Music & Art', description: 'Always listening, always creating something', label: 'Core', emoji: '🎵', color: '#080514' },
  { title: 'Skating', description: 'Any kind, any surface — board, blades, whatever', label: 'Sport', emoji: '🛹', color: '#060d0a' },
  { title: 'Gaming', description: 'PC, console, and building my own games', label: 'Hobby', emoji: '🎮', color: '#06050f' },
  { title: 'Collecting', description: 'Things worth keeping — records, gear, random finds', label: 'Habit', emoji: '📦', color: '#0d0806' },
  { title: 'Concerts', description: 'Live music is a completely different experience', label: 'Culture', emoji: '🎤', color: '#0a0610' },
  { title: 'Staying Productive', description: 'Always working on something new', label: 'Drive', emoji: '⚡', color: '#060a08' },
]

// ── Project data for CardSwap ──────────────────────────────────────────────────
interface Project {
  title: string
  tag: string
  description: string
  link?: string
  color: string
}

const PROJECTS: Project[] = [
  {
    title: 'TheAdrianBlog',
    tag: 'Web · Live',
    description: 'Full-stack blog platform with music reviews, track audio previews, community ratings, inline comments, and a custom publishing dashboard. Built with React, TypeScript, Vite, and Supabase.',
    link: 'https://www.theadrianblog.com',
    color: '#00f5ff',
  },
  {
    title: 'Super Sumo Derby',
    tag: 'Roblox Game',
    description: 'A vehicle derby game built in Roblox Studio with a full dealership system, multiple vehicle tiers, Bucks/Robux purchases, custom garage UI, and A-Chassis physics. Cyberpunk aesthetic.',
    color: '#b400ff',
  },
  {
    title: 'YouTube Channel',
    tag: 'Content',
    description: 'Video production covering tech, gaming, music and lifestyle content. Full production from scripting to filming and editing in DaVinci Resolve and Adobe Premiere.',
    color: '#ff0000',
  },
  {
    title: 'Learning Ableton',
    tag: 'Music Production',
    description: 'Working through music production from scratch — composition, sound design, mixing, and beat-making. Aiming to release original music.',
    color: '#00ff88',
  },
  {
    title: 'Car Restoration',
    tag: 'Hands-on',
    description: 'Diagnosing and repairing my own car — learning mechanics, sourcing parts, and doing as much of the work as possible myself.',
    color: '#ffd700',
  },
]

// ── Reveal on scroll hook ─────────────────────────────────────────────────────
function useReveal(ref: React.RefObject<Element | null>, threshold = 0.15) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return visible
}

// ── Tag pill ──────────────────────────────────────────────────────────────────
function Tag({ label, color }: { label: string; color: string }) {
  return <span className="ap-tag" style={{ '--tag-color': color } as React.CSSProperties}>{label}</span>
}

// ── Section wrapper ───────────────────────────────────────────────────────────
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

  // Subtle parallax on hero background
  useEffect(() => {
    const onScroll = () => {
      if (parallaxRef.current) {
        parallaxRef.current.style.transform = `translateY(${window.scrollY * 0.3}px)`
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="ap-page">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="ap-hero">
        <div ref={parallaxRef} className="ap-hero-bg" />

        <div className="ap-hero-content">
          {/* Metallic title */}
          <div className="ap-metallic-wrap">
            <MetallicPaint
              imageSrc={ADRIAN_SVG}
              scale={3.5}
              speed={0.25}
              liquid={0.6}
              brightness={2.2}
              contrast={0.55}
              refraction={0.012}
              blur={0.012}
              tintColor="#00f5ff"
              lightColor="#ffffff"
              darkColor="#001a1a"
              waveAmplitude={0.9}
              noiseScale={0.45}
              chromaticSpread={2.5}
              distortion={0.8}
              contour={0.15}
            />
          </div>

          {/* Last name + role */}
          <div className="ap-hero-sub">
            <span className="ap-hero-surname">DABROWSKI</span>
            <span className="ap-hero-dot">·</span>
            <span className="ap-hero-role">EV Support Engineer</span>
          </div>

          {/* Location + languages */}
          <div className="ap-hero-meta">
            <span className="ap-hero-meta-item">📍 Essex, UK</span>
            <span className="ap-hero-meta-item">🇬🇧 English</span>
            <span className="ap-hero-meta-item">🇵🇱 Polish</span>
            <span className="ap-hero-meta-item">🏍 Car & Motorbike</span>
          </div>

          {/* Social links — same as before */}
          <div className="ap-hero-links">
            <a href="https://github.com/ThatAdrian" target="_blank" rel="noopener noreferrer" className="ap-hero-link">GitHub</a>
            <a href="https://www.linkedin.com/in/adriandabrowski" target="_blank" rel="noopener noreferrer" className="ap-hero-link">LinkedIn</a>
            <a href="https://open.spotify.com/user/realagamez123" target="_blank" rel="noopener noreferrer" className="ap-hero-link">Spotify</a>
            <a href="https://www.last.fm/user/agamez123" target="_blank" rel="noopener noreferrer" className="ap-hero-link">Last.fm</a>
          </div>
        </div>

        <div className="ap-scroll-hint">
          <span>scroll</span>
          <div className="ap-scroll-line" />
        </div>
      </section>

      {/* ── ABOUT ────────────────────────────────────────────────────── */}
      <Section id="about" className="ap-about-section">
        <div className="ap-sticky-inner">
          <div className="ap-about-grid">
            <div className="ap-about-left">
              <p className="ap-section-eyebrow">Who I am</p>
              <h2 className="ap-section-title">A bit about<br />me</h2>
              <GlassSurface width="100%" height="auto" borderRadius={16} brightness={8} opacity={0.5} blur={10}>
                <div className="ap-bio-card">
                  <p>I'm Adrian — an EV Support Engineer based in Essex, working in the manufacturing of EV charging equipment and electrical components.</p>
                  <p>Outside of work I spend my time making music, building things on the web, developing a Roblox game, shooting videos, and fixing my car. I studied Computer Science and Electronics & Robotics in college which gave me a good foundation, but most of what I do now is self-taught.</p>
                  <p>This site is one of those projects — built from scratch with React and TypeScript, with a custom dashboard, audio previews, community ratings, and a lot of other things I wanted to see on a blog.</p>
                </div>
              </GlassSurface>
            </div>

            <div className="ap-about-right">
              <div className="ap-about-tags">
                {['Self-taught', 'Music Producer', 'Game Dev', 'Tech Enthusiast', 'Content Creator', 'Hardware Tinkerer', 'Computer Science', 'Electronics & Robotics'].map(t => (
                  <span key={t} className="ap-about-tag">{t}</span>
                ))}
              </div>

              <div className="ap-stats-grid">
                {[
                  { value: '4+', label: 'Years in EV Industry' },
                  { value: '∞', label: 'Things to learn' },
                  { value: '2', label: 'Languages' },
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

      {/* ── SKILLS ───────────────────────────────────────────────────── */}
      <Section id="skills" className="ap-skills-section">
        <div className="ap-sticky-inner">
          <p className="ap-section-eyebrow">What I work with</p>
          <h2 className="ap-section-title">Skills</h2>

          <div className="ap-skills-layout">
            <BounceCards
              images={SKILL_IMAGES}
              containerWidth={420}
              containerHeight={220}
              animationDelay={0.3}
              animationStagger={0.07}
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
                <div key={group.label} className="ap-skill-group">
                  <span className="ap-skill-group-label" style={{ color: group.color }}>{group.label}</span>
                  <div className="ap-skill-pills">
                    {group.skills.map(s => <Tag key={s} label={s} color={group.color} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── PROJECTS ─────────────────────────────────────────────────── */}
      <Section id="projects" className="ap-projects-section">
        <div className="ap-sticky-inner">
          <p className="ap-section-eyebrow">What I'm building</p>
          <h2 className="ap-section-title">Projects</h2>

          <div className="ap-projects-layout">
            {/* Project info panel */}
            <div className="ap-project-info">
              {PROJECTS.map((p, i) => (
                <div key={p.title} className={`ap-project-detail ${i === activeProject ? 'active' : ''}`}>
                  <GlassSurface width="100%" height="auto" borderRadius={16} brightness={6} opacity={0.45} blur={8}>
                    <div className="ap-project-card">
                      <div className="ap-project-header">
                        <h3 className="ap-project-title" style={{ color: p.color }}>{p.title}</h3>
                        <span className="ap-project-tag">{p.tag}</span>
                      </div>
                      <p className="ap-project-desc">{p.description}</p>
                      {p.link && (
                        <a href={p.link} target="_blank" rel="noopener noreferrer" className="ap-project-link" style={{ color: p.color }}>
                          Visit site →
                        </a>
                      )}
                    </div>
                  </GlassSurface>
                </div>
              ))}
            </div>

            {/* CardSwap */}
            <div className="ap-cardswap-wrap">
              <CardSwap
                width={300}
                height={360}
                cardDistance={50}
                verticalDistance={60}
                delay={4000}
                pauseOnHover={true}
                skewAmount={4}
                easing="elastic"
                onCardClick={setActiveProject}
              >
                {PROJECTS.map((p, i) => (
                  <Card key={p.title} style={{ padding: 0, overflow: 'hidden', background: '#080514', border: `1px solid ${p.color}30` }}>
                    <div className="ap-swap-card-inner" style={{ '--card-accent': p.color } as React.CSSProperties}>
                      <div className="ap-swap-card-top" style={{ background: `linear-gradient(135deg, ${p.color}15, transparent)` }}>
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

      {/* ── INTERESTS ────────────────────────────────────────────────── */}
      <Section id="interests" className="ap-interests-section">
        <div className="ap-sticky-inner">
          <p className="ap-section-eyebrow">Outside the work</p>
          <h2 className="ap-section-title">Interests</h2>
          <MagicBento
            cards={INTERESTS}
            glowColor="0, 245, 255"
            enableStars={true}
            enableSpotlight={true}
            enableBorderGlow={true}
            enableMagnetism={true}
            clickEffect={true}
            particleCount={6}
          />
        </div>
      </Section>

    </div>
  )
}
