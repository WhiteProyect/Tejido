import { useState, useEffect, useMemo } from 'react';

const testimonials = [
  { text: "El río Cauca no solo lleva agua, lleva nuestra historia.", author: "María, Caucasia" },
  { text: "Aquí nacen los cantos que hacen latir al Bajo Cauca.", author: "Carlos, El Bagre" },
  { text: "Cada piedra del río guarda un secreto por contar.", author: "Ana, Zaragoza" },
  { text: "Nuestra tierra es fértil en talento y en esperanza.", author: "Luis, Tarazá" },
];

function generateSnakePath() {
  const curves = [];
  const numCurves = 4 + Math.floor(Math.random() * 2);
  let y = 280 + Math.random() * 80;
  let x = -80;

  curves.push(`M${x},${y}`);

  for (let i = 0; i < numCurves; i++) {
    const direction = i % 2 === 0 ? -1 : 1;
    const cp1x = x + 120 + Math.random() * 60;
    const cp1y = y + direction * (100 + Math.random() * 80);
    const cp2x = cp1x + 100 + Math.random() * 60;
    const cp2y = y + direction * (60 + Math.random() * 60);
    x = cp2x + 80 + Math.random() * 40;
    y = y + direction * (20 + Math.random() * 40);
    curves.push(`C${cp1x},${cp1y} ${cp2x},${cp2y} ${x},${y}`);
  }

  return curves.join(' ');
}

function getEndPoint(path) {
  const nums = path.match(/[\d.]+/g);
  return { x: parseFloat(nums[nums.length - 2]), y: parseFloat(nums[nums.length - 1]) };
}

function getStartPoint(path) {
  const nums = path.match(/[\d.]+/g);
  return { x: parseFloat(nums[0]), y: parseFloat(nums[1]) };
}

function generateScales(path, count = 14) {
  const nums = path.match(/[\d.]+/g);
  if (!nums || nums.length < 6) return [];
  const scales = [];
  const totalPoints = nums.length / 2;
  const step = Math.max(1, Math.floor(totalPoints / count));
  for (let i = 1; i < count && i * step < totalPoints - 1; i++) {
    const idx = i * step * 2;
    if (idx + 1 < nums.length) {
      scales.push({
        x: parseFloat(nums[idx]),
        y: parseFloat(nums[idx + 1]),
        size: 4 + Math.random() * 3,
        opacity: 0.06 + Math.random() * 0.06,
      });
    }
  }
  return scales;
}

export default function HeroSection({ onExplore }) {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const snakePath = useMemo(() => generateSnakePath(), []);
  const headPos = useMemo(() => getEndPoint(snakePath), [snakePath]);
  const tailPos = useMemo(() => getStartPoint(snakePath), [snakePath]);
  const scales = useMemo(() => generateScales(snakePath), [snakePath]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="hero-cultural" id="inicio">
      <div className="hero-cultural-bg" aria-hidden="true">
        <svg className="hero-river-svg" viewBox="0 0 1400 600" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="riverGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1d8fa3" stopOpacity="0.03"/>
              <stop offset="20%" stopColor="#1d8fa3" stopOpacity="0.15"/>
              <stop offset="80%" stopColor="#1d8fa3" stopOpacity="0.15"/>
              <stop offset="100%" stopColor="#1d8fa3" stopOpacity="0.03"/>
            </linearGradient>
            <linearGradient id="riverGradInner" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1d8fa3" stopOpacity="0"/>
              <stop offset="20%" stopColor="#1d8fa3" stopOpacity="0.25"/>
              <stop offset="80%" stopColor="#1d8fa3" stopOpacity="0.25"/>
              <stop offset="100%" stopColor="#1d8fa3" stopOpacity="0"/>
            </linearGradient>
            <radialGradient id="headGlow">
              <stop offset="0%" stopColor="#1d8fa3" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#1d8fa3" stopOpacity="0"/>
            </radialGradient>
            <radialGradient id="headGlowPulse">
              <stop offset="0%" stopColor="#3db8c9" stopOpacity="0.4">
                <animate attributeName="stopOpacity" values="0.4;0.6;0.4" dur="3s" repeatCount="indefinite"/>
              </stop>
              <stop offset="100%" stopColor="#1d8fa3" stopOpacity="0"/>
            </radialGradient>
            <linearGradient id="scaleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3db8c9" stopOpacity="0.12"/>
              <stop offset="100%" stopColor="#1d8fa3" stopOpacity="0.04"/>
            </linearGradient>
            <linearGradient id="tongueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c44" stopOpacity="0.5"/>
              <stop offset="100%" stopColor="#a33" stopOpacity="0.3"/>
            </linearGradient>
            {/* Agua */}
            <linearGradient id="waterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1d8fa3" stopOpacity="0.18"/>
              <stop offset="40%" stopColor="#1a7a8c" stopOpacity="0.12"/>
              <stop offset="100%" stopColor="#165f6e" stopOpacity="0.06"/>
            </linearGradient>
            <linearGradient id="waterShine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0"/>
              <stop offset="50%" stopColor="#fff" stopOpacity="0.08"/>
              <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
            </linearGradient>
            {/* Oro */}
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f4d03f"/>
              <stop offset="50%" stopColor="#d4a843"/>
              <stop offset="100%" stopColor="#b8860b"/>
            </linearGradient>
            <radialGradient id="goldSparkle">
              <stop offset="0%" stopColor="#f4d03f" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="#d4a843" stopOpacity="0"/>
            </radialGradient>
            {/* Madera canoa */}
            <linearGradient id="woodGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8B5E3C"/>
              <stop offset="50%" stopColor="#6B4226"/>
              <stop offset="100%" stopColor="#5C3317"/>
            </linearGradient>
            {/* Piel barequero */}
            <linearGradient id="skinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8B6914"/>
              <stop offset="100%" stopColor="#6B4F12"/>
            </linearGradient>
          </defs>

          {/* Sombra del cuerpo */}
          <path
            className="hero-snake-shadow"
            d={snakePath}
            fill="none"
            stroke="rgba(12,36,30,0.06)"
            strokeWidth="90"
            strokeLinecap="round"
            transform="translate(4, 6)"
          />

          {/* Cuerpo de la serpiente/rio */}
          <path
            className="hero-snake-body"
            d={snakePath}
            fill="none"
            stroke="url(#riverGrad)"
            strokeWidth="80"
            strokeLinecap="round"
          />

          {/* Escamas a lo largo del cuerpo */}
          {scales.map((s, i) => (
            <g key={`scale-${i}`} className="hero-scale" style={{ animationDelay: `${i * 0.15}s` }}>
              <ellipse
                cx={s.x}
                cy={s.y}
                rx={s.size}
                ry={s.size * 0.65}
                fill="url(#scaleGrad)"
                opacity={s.opacity}
                transform={`rotate(${-15 + (i % 3) * 15}, ${s.x}, ${s.y})`}
              />
            </g>
          ))}

          {/* Linea central */}
          <path
            className="hero-snake-spine"
            d={snakePath}
            fill="none"
            stroke="url(#riverGradInner)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="14 9"
          />

          {/* Brillo del cuerpo - highlight superior */}
          <path
            className="hero-snake-highlight"
            d={snakePath}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="40 80"
            strokeDashoffset="20"
          />

          {/* === AGUA: Superficie con ondas === */}
          <g className="hero-water-surface">
            <path
              className="hero-water-wave hero-water-wave-1"
              d="M0,430 Q100,415 200,430 Q300,445 400,430 Q500,415 600,430 Q700,445 800,430 Q900,415 1000,430 Q1100,445 1200,430 Q1300,415 1400,430 L1400,600 L0,600 Z"
              fill="url(#waterGrad)"
            />
            <path
              className="hero-water-wave hero-water-wave-2"
              d="M0,445 Q120,430 240,445 Q360,460 480,445 Q600,430 720,445 Q840,460 960,445 Q1080,430 1200,445 Q1320,460 1400,445 L1400,600 L0,600 Z"
              fill="url(#waterGrad)"
              opacity="0.6"
            />
            <path
              className="hero-water-wave hero-water-wave-3"
              d="M0,460 Q80,450 160,460 Q240,470 320,460 Q400,450 480,460 Q560,470 640,460 Q720,450 800,460 Q880,470 960,460 Q1040,450 1120,460 Q1200,470 1280,460 Q1360,450 1400,460 L1400,600 L0,600 Z"
              fill="url(#waterGrad)"
              opacity="0.35"
            />
            {/* Brillos en el agua */}
            <ellipse className="hero-water-shine" cx="350" cy="440" rx="60" ry="3" fill="url(#waterShine)"/>
            <ellipse className="hero-water-shine" cx="750" cy="435" rx="80" ry="4" fill="url(#waterShine)" style={{animationDelay: '1.5s'}}/>
            <ellipse className="hero-water-shine" cx="1100" cy="442" rx="50" ry="3" fill="url(#waterShine)" style={{animationDelay: '3s'}}/>
          </g>

          {/* === BAREQUERO: Silueta en orilla izquierda === */}
          <g className="hero-barequero">
            {/* Sombrero */}
            <ellipse cx="0" cy="-45" rx="14" ry="6" fill="#5C3317" opacity="0.7"/>
            <ellipse cx="0" cy="-50" rx="9" ry="8" fill="#6B4226" opacity="0.65"/>
            {/* Cabeza */}
            <circle cx="0" cy="-38" r="7" fill="url(#skinGrad)" opacity="0.6"/>
            {/* Cuerpo - agachado */}
            <path d="M0,-31 Q8,-15 12,5 Q14,15 10,20" fill="none" stroke="#5C3317" strokeWidth="5" strokeLinecap="round" opacity="0.55"/>
            {/* Brazo con batea */}
            <path d="M8,-20 Q20,-10 30,-5" fill="none" stroke="#6B4F12" strokeWidth="3" strokeLinecap="round" opacity="0.5"/>
            {/* Batea/orina */}
            <ellipse cx="34" cy="-2" rx="12" ry="5" fill="#8B7355" opacity="0.45" transform="rotate(-10, 34, -2)"/>
            <ellipse cx="34" cy="-3" rx="9" ry="3.5" fill="#a08060" opacity="0.3"/>
            {/* Piernas */}
            <path d="M5,15 L0,35" stroke="#5C3317" strokeWidth="3.5" strokeLinecap="round" opacity="0.45"/>
            <path d="M10,15 L15,35" stroke="#5C3317" strokeWidth="3.5" strokeLinecap="round" opacity="0.45"/>
          </g>

          {/* === CANOA: Flotando en el agua === */}
          <g className="hero-canoe">
            {/* Casco de la canoa */}
            <path
              d="M-50,0 Q-45,-12 -30,-15 L30,-15 Q45,-12 50,0 Q40,8 0,10 Q-40,8 -50,0 Z"
              fill="url(#woodGrad)"
              opacity="0.55"
            />
            {/* Borde superior */}
            <path
              d="M-48,-2 Q-40,-14 -28,-16 L28,-16 Q40,-14 48,-2"
              fill="none"
              stroke="#A0724A"
              strokeWidth="1.5"
              opacity="0.4"
            />
            {/* Lineas de madera */}
            <line x1="-35" y1="-8" x2="35" y2="-8" stroke="#5C3317" strokeWidth="0.5" opacity="0.3"/>
            <line x1="-40" y1="-3" x2="40" y2="-3" stroke="#5C3317" strokeWidth="0.5" opacity="0.25"/>
            {/* Reflejo en agua */}
            <path
              d="M-45,10 Q-40,18 0,20 Q40,18 45,10"
              fill="url(#waterGrad)"
              opacity="0.15"
            />
          </g>

          {/* === PESCADO SALTANDO === */}
          <g className="hero-fish-jump">
            {/* Arco de salto (gotas) */}
            <circle cx="-20" cy="30" r="1.5" fill="#3db8c9" opacity="0.3"/>
            <circle cx="-10" cy="15" r="1" fill="#3db8c9" opacity="0.25"/>
            <circle cx="5" cy="5" r="1.2" fill="#3db8c9" opacity="0.2"/>
            {/* Cuerpo del pez */}
            <path
              d="M0,0 Q10,-8 25,-5 Q30,-2 25,3 Q10,8 0,0 Z"
              fill="url(#goldGrad)"
              opacity="0.6"
            />
            {/* Cola */}
            <path
              d="M-5,0 L-15,-7 L-15,7 Z"
              fill="#d4a843"
              opacity="0.5"
            />
            {/* Ojo */}
            <circle cx="20" cy="-2" r="1.5" fill="#0c241e" opacity="0.5"/>
            <circle cx="20.5" cy="-2.5" r="0.5" fill="#fff" opacity="0.3"/>
            {/* Aleta */}
            <path
              d="M10,-4 Q12,-10 18,-6"
              fill="none"
              stroke="#d4a843"
              strokeWidth="1"
              opacity="0.4"
            />
          </g>

          {/* === PESCADOS DORADOS NADANDO === */}
          <g className="hero-golden-fishes">
            {/* Pez 1 */}
            <g className="hero-golden-fish hero-golden-fish-1">
              <path d="M0,0 Q6,-4 15,-3 Q18,-1 15,2 Q6,5 0,0 Z" fill="url(#goldGrad)" opacity="0.45"/>
              <path d="M-3,0 L-8,-4 L-8,4 Z" fill="#d4a843" opacity="0.35"/>
              <circle cx="12" cy="-1" r="1" fill="#0c241e" opacity="0.4"/>
            </g>
            {/* Pez 2 */}
            <g className="hero-golden-fish hero-golden-fish-2">
              <path d="M0,0 Q5,-3 12,-2 Q14,0 12,2 Q5,4 0,0 Z" fill="url(#goldGrad)" opacity="0.35"/>
              <path d="M-2,0 L-6,-3 L-6,3 Z" fill="#d4a843" opacity="0.3"/>
              <circle cx="10" cy="-0.5" r="0.8" fill="#0c241e" opacity="0.35"/>
            </g>
            {/* Pez 3 */}
            <g className="hero-golden-fish hero-golden-fish-3">
              <path d="M0,0 Q7,-5 18,-3 Q21,0 18,3 Q7,6 0,0 Z" fill="url(#goldGrad)" opacity="0.4"/>
              <path d="M-4,0 L-10,-5 L-10,5 Z" fill="#d4a843" opacity="0.32"/>
              <circle cx="14" cy="-1" r="1.2" fill="#0c241e" opacity="0.38"/>
            </g>
          </g>

          {/* === PARTÍCULAS DE ORO === */}
          <g className="hero-gold-particles">
            <circle className="hero-gold-dot hero-gold-dot-1" cx="200" cy="455" r="2" fill="url(#goldGrad)" opacity="0.5"/>
            <circle className="hero-gold-dot hero-gold-dot-2" cx="500" cy="465" r="1.5" fill="url(#goldGrad)" opacity="0.4"/>
            <circle className="hero-gold-dot hero-gold-dot-3" cx="650" cy="450" r="2.5" fill="url(#goldGrad)" opacity="0.45"/>
            <circle className="hero-gold-dot hero-gold-dot-4" cx="900" cy="460" r="1.8" fill="url(#goldGrad)" opacity="0.35"/>
            <circle className="hero-gold-dot hero-gold-dot-5" cx="1150" cy="455" r="2" fill="url(#goldGrad)" opacity="0.42"/>
            <circle className="hero-gold-dot hero-gold-dot-6" cx="350" cy="480" r="1.2" fill="url(#goldGrad)" opacity="0.3"/>
            <circle className="hero-gold-dot hero-gold-dot-7" cx="800" cy="475" r="1.8" fill="url(#goldGrad)" opacity="0.38"/>
            <circle className="hero-gold-dot hero-gold-dot-8" cx="1000" cy="470" r="1.5" fill="url(#goldGrad)" opacity="0.33"/>
          </g>

          {/* Cabeza de la serpiente - forma organica */}
          <g className="hero-snake-head">
            {/* Halo exterior pulsante */}
            <circle cx={headPos.x} cy={headPos.y} r="34" fill="url(#headGlowPulse)"/>
            {/* Cabeza base */}
            <ellipse cx={headPos.x} cy={headPos.y} rx="16" ry="12" fill="#1d8fa3" opacity="0.4"/>
            {/* Mandibula superior */}
            <ellipse cx={headPos.x + 2} cy={headPos.y - 2} rx="12" ry="8" fill="#1d8fa3" opacity="0.3"/>
            {/* Pupila izquierda */}
            <circle cx={headPos.x - 5} cy={headPos.y - 4} r="3" fill="#0c241e" opacity="0.6"/>
            <circle cx={headPos.x - 4} cy={headPos.y - 5} r="1" fill="#fff" opacity="0.4"/>
            {/* Pupila derecha */}
            <circle cx={headPos.x + 5} cy={headPos.y - 4} r="3" fill="#0c241e" opacity="0.6"/>
            <circle cx={headPos.x + 6} cy={headPos.y - 5} r="1" fill="#fff" opacity="0.4"/>
            {/* Lengua bifida */}
            <g className="hero-tongue">
              <path
                d={`M${headPos.x + 14},${headPos.y} L${headPos.x + 24},${headPos.y - 4} M${headPos.x + 14},${headPos.y} L${headPos.x + 24},${headPos.y + 4}`}
                fill="none"
                stroke="url(#tongueGrad)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </g>
          </g>

          {/* Cola con desvanecimiento */}
          <circle cx={tailPos.x} cy={tailPos.y} r="8" fill="#1d8fa3" opacity="0.12"/>
          <circle cx={tailPos.x - 4} cy={tailPos.y} r="4" fill="#1d8fa3" opacity="0.06"/>
        </svg>

        {/* Montaña SVG detallada */}
        <svg className="hero-mountain-svg" viewBox="0 0 400 350" preserveAspectRatio="xMidYMax meet">
          <defs>
            <linearGradient id="mountainBack" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1a3d2a" stopOpacity="0.12"/>
              <stop offset="100%" stopColor="#1a3d2a" stopOpacity="0.04"/>
            </linearGradient>
            <linearGradient id="mountainMid" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2d5a3f" stopOpacity="0.1"/>
              <stop offset="100%" stopColor="#2d5a3f" stopOpacity="0.03"/>
            </linearGradient>
            <linearGradient id="mountainFront" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4a7c5c" stopOpacity="0.08"/>
              <stop offset="100%" stopColor="#4a7c5c" stopOpacity="0.02"/>
            </linearGradient>
            <radialGradient id="mountainFog" cx="50%" cy="100%" r="60%">
              <stop offset="0%" stopColor="#faf3e6" stopOpacity="0.4"/>
              <stop offset="100%" stopColor="#faf3e6" stopOpacity="0"/>
            </radialGradient>
          </defs>
          {/* Capa trasera - montaña lejana */}
          <path d="M50,340 L140,120 L175,155 L220,90 L280,140 L350,340 Z" fill="url(#mountainBack)" className="hero-mountain-layer hero-mountain-back"/>
          {/* Capa media */}
          <path d="M20,340 L100,180 L145,210 L190,150 L240,195 L300,160 L380,340 Z" fill="url(#mountainMid)" className="hero-mountain-layer hero-mountain-mid"/>
          {/* Capa frontal - mas detallada */}
          <path d="M0,340 L70,220 L110,245 L150,195 L185,225 L230,180 L275,215 L320,190 L400,340 Z" fill="url(#mountainFront)" className="hero-mountain-layer hero-mountain-front"/>
          {/* Vegetacion - puntos verdes */}
          <circle cx="155" cy="200" r="4" fill="#2d5a3f" opacity="0.1"/>
          <circle cx="235" cy="185" r="3" fill="#2d5a3f" opacity="0.08"/>
          <circle cx="110" cy="248" r="5" fill="#4a7c5c" opacity="0.07"/>
          <circle cx="280" cy="218" r="3.5" fill="#4a7c5c" opacity="0.06"/>
          {/* Niebla en la base */}
          <ellipse cx="200" cy="330" rx="180" ry="40" fill="url(#mountainFog)" className="hero-mountain-fog"/>
        </svg>

        {/* Sol con halo y rays */}
        <div className="hero-sun-wrapper">
          <div className="hero-sun-rays"></div>
          <div className="hero-sun"></div>
          <div className="hero-sun-halo"></div>
        </div>
      </div>
      <div className="hero-cultural-content">
        <div className="hero-cultural-badge">
       
        
        </div>
        <h1 className="hero-cultural-title">
          Donde el río <em>cuenta</em> historias
        </h1>
        <p className="hero-cultural-subtitle">
          Descubre el alma del Bajo Cauca: historias que nacen del río, 
          encuentros que tejen comunidad, oportunidades que brotan de la tierra 
          y talentos que brillan como el oro.
        </p>
        
        <div className="hero-testimonial">
          <p className="testimonial-text">"{testimonials[currentTestimonial].text}"</p>
          <span className="testimonial-author">— {testimonials[currentTestimonial].author}</span>
        </div>

        <div className="hero-cultural-actions">
          <a className="btn-primary-cultural" href="#explorar">
            Explorar Territorio
          </a>
          <a className="btn-secondary-cultural" href="#agenda">
            Próximos Eventos
          </a>
        </div>
        <div className="hero-support-actions">
          <a className="btn-donate" href="#donar">
            <span className="btn-icon">♥</span>
            Donar a Tejido
          </a>
          <a className="btn-collaborate" href="#colaborar">
            <span className="btn-icon">★</span>
            Colaborar
          </a>
        </div>
      </div>
      <div className="hero-cultural-visual" aria-hidden="true">
        <div className="visual-card visual-card-1">
          <span className="visual-text">Caucasia</span>
        </div>
        <div className="visual-card visual-card-2">
          <span className="visual-text">Oro Ancestral</span>
        </div>
        <div className="visual-card visual-card-3">
          <span className="visual-text">Música Viva</span>
        </div>
      </div>
    </section>
  );
}
