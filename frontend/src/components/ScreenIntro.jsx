import { EYEBROW, H1 } from './uiStyles.js';

export default function ScreenIntro({ eyebrow, title, description }) {
  return (
    <header className="mb-[45px] max-w-[720px]">
      <p className={EYEBROW}>{eyebrow}</p>
      <h1 className={H1}>{title}</h1>
      <p className="text-[#53645c] text-[18px] leading-[1.6] max-w-[560px]">{description}</p>
    </header>
  );
}
