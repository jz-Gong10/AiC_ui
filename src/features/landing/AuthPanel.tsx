import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { useAuth } from '../../app/AuthProvider';
import { demoAvailable } from '../../shared/demoMode';
import { errorText } from '../../shared/errors';

gsap.registerPlugin(useGSAP);

export function AuthPanel() {
  const auth = useAuth();
  const navigate = useNavigate();
  const content = useRef<HTMLDivElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useGSAP(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(content.current, { autoAlpha: 0, x: register ? 16 : -16 },
        { autoAlpha: 1, x: 0, duration: 0.32, ease: 'power2.out' });
    }
  }, { scope: content, dependencies: [register], revertOnUpdate: true });

  function changeMode(next: boolean) {
    if (busy || next === register) return;
    setRegister(next);
    setError('');
    setShowPassword(false);
  }

  function tabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'End' || (event.key !== 'Home' && !register);
    changeMode(next);
    tabs.current?.querySelectorAll<HTMLButtonElement>('button')[next ? 1 : 0]?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (register) await auth.signUp(email.trim(), password, name.trim());
      else await auth.signIn(email.trim(), password);
      navigate('/projects', { replace: true });
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  }

  return <div className="landing-auth-card">
    <div className="landing-auth-tabs" ref={tabs} role="tablist" aria-label="账户操作" data-register={register}>
      <span className="landing-tab-indicator" aria-hidden="true" />
      <button id="landing-login-tab" type="button" role="tab" aria-selected={!register} aria-controls="landing-auth-content"
        tabIndex={register ? -1 : 0} disabled={busy} onKeyDown={tabKey} onClick={() => changeMode(false)}>登录</button>
      <button id="landing-register-tab" type="button" role="tab" aria-selected={register} aria-controls="landing-auth-content"
        tabIndex={register ? 0 : -1} disabled={busy} onKeyDown={tabKey} onClick={() => changeMode(true)}>注册</button>
    </div>
    <div ref={content} id="landing-auth-content" role="tabpanel" aria-labelledby={register ? 'landing-register-tab' : 'landing-login-tab'}>
      <div className="landing-auth-heading">
        <h2>{register ? '让精彩，有处可留。' : '欢迎回来。'}</h2>
        <p>{register ? '创建账户，开启你的第一个选片工作区。' : '登录 CullPilot，继续你的选片旅程。'}</p>
      </div>
      <form onSubmit={submit} aria-label={register ? '注册账户' : '登录账户'} aria-busy={busy}>
        <div className="landing-name-field" data-open={register} inert={!register} aria-hidden={!register}><div><label className="landing-field">显示名称
          <span className="landing-input"><UserRound size={17} aria-hidden="true" /><input name="displayName" autoComplete="nickname"
            value={name} disabled={busy || !register} onChange={event => setName(event.target.value)} maxLength={100} placeholder="怎么称呼你" /></span>
        </label></div></div>
        <label className="landing-field">邮箱地址
          <span className="landing-input"><Mail size={17} aria-hidden="true" /><input type="email" name="email" autoComplete="email"
            required value={email} disabled={busy} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" /></span>
        </label>
        <label className="landing-field">密码
          <span className="landing-input"><LockKeyhole size={17} aria-hidden="true" /><input type={showPassword ? 'text' : 'password'} name="password"
            autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : undefined} maxLength={72} required
            value={password} disabled={busy} onChange={event => setPassword(event.target.value)} placeholder={register ? '设置 8–72 位密码' : '输入你的密码'} />
            <button className="landing-password-toggle" type="button" aria-label={showPassword ? '隐藏密码' : '显示密码'}
              aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </span>
        </label>
        {error && <p className="landing-auth-error" role="alert">{error}</p>}
        <button className="landing-button landing-submit" disabled={busy} type="submit">
          {busy ? '请稍候…' : register ? '创建账户' : '登录工作台'}<ArrowRight size={17} aria-hidden="true" />
        </button>
        <p className="landing-switch">{register ? '已经有账户？' : '还没有账户？'}
          <button type="button" disabled={busy} onClick={() => changeMode(!register)}>{register ? '返回登录' : '创建账户'}</button>
        </p>
      </form>
    </div>
    {demoAvailable && <div className="landing-demo">
      <button type="button" disabled={busy} onClick={() => { auth.enterDemo(); navigate('/projects', { replace: true }); }}>进入本地演示（无需登录）<ArrowRight size={14} /></button>
      <p>演示数据仅在当前页面运行，刷新后重置。</p>
    </div>}
    <p className="landing-storage-note"><LockKeyhole size={13} aria-hidden="true" /><span>登录后，照片上传至当前配置的 CullPilot 服务，存储位置由服务端决定。</span></p>
  </div>;
}
