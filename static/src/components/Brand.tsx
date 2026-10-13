import { href } from '../base';
export function Brand({ className = '' }: { className?: string }) {
  return <a className={`brand ${className}`.trim()} href={href('/')}>
    <span className="brand-mark" aria-hidden="true"><img src={href('/logo.svg')} alt="" width="42" height="42" /></span>
    PharmReach
  </a>;
}
