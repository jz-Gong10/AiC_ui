import { useState, type FormEvent } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { ArrowRight, LockKeyhole, Mail, Sparkles } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { Workspace } from './Workspace';
import { errorText } from '../shared/errors';
import { demoAvailable } from '../shared/demoMode';
import { BrandLogo } from '../shared/BrandLogo';

function AuthScreen() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (register) await auth.signUp(email.trim(), password, name.trim());
      else await auth.signIn(email.trim(), password);
      navigate('/projects', { replace: true });
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }
  return <main className="auth-page">
    <div className="auth-intro"><BrandLogo inverse className="brand-mark" /><span className="eyebrow">你的智能选片工作台</span><h1>好照片，<br /><em>值得被看见。</em></h1><p>把一次拍摄放进专属工作区，浏览、复核并导出你真正想留下的画面。</p><div className="auth-art"><div className="art-card art-one" /><div className="art-card art-two" /><div className="art-card art-three" /><span><Sparkles size={17} /> 你的决定始终优先</span></div></div>
    <div className="auth-form-wrap"><form className="auth-card" onSubmit={submit}><span className="eyebrow">欢迎使用 CULLPILOT</span><h2>{register ? '创建账户' : '继续你的选片旅程'}</h2><p className="muted">{register ? '注册后即可创建自己的工作区。' : '登录后查看你的工作区和照片。'}</p>
      {register && <label className="field">显示名称<input value={name} onChange={event => setName(event.target.value)} maxLength={100} placeholder="怎么称呼你" /></label>}
      <label className="field">邮箱地址<div className="input-icon"><Mail size={17} /><input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" /></div></label>
      <label className="field">密码<div className="input-icon"><LockKeyhole size={17} /><input type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : undefined} maxLength={72} required value={password} onChange={event => setPassword(event.target.value)} placeholder={register ? '8–72 位密码' : '输入密码'} /></div></label>
      {error && <p className="error-note" role="alert">{error}</p>}
      <button className="button primary auth-submit" disabled={busy} type="submit">{busy ? '请稍候…' : register ? '创建账户' : '登录工作台'}<ArrowRight size={17} /></button>
      <p className="switch-auth">{register ? '已经有账户？' : '第一次使用？'} <button type="button" onClick={() => { setRegister(!register); setError(''); }}>{register ? '返回登录' : '创建账户'}</button></p>
      {demoAvailable && <><button className="button ghost full" type="button" onClick={() => { auth.enterDemo(); navigate('/projects', { replace: true }); }}>进入本地演示（无需登录）</button><p className="muted">演示数据仅在当前页面运行，刷新后会重置，不会发送给后端。</p></>}
      <small className="muted">正常登录后，照片上传至当前配置的 CullPilot 服务，具体存储位置由服务端决定。</small>
    </form></div>
  </main>;
}
export function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="boot-screen"><BrandLogo className="boot-logo" /><span>正在连接…</span></div>;
  return <Routes>
    <Route path="/login" element={user ? <Navigate to="/projects" replace /> : <AuthScreen />} />
    <Route path="/projects" element={user ? <Workspace /> : <Navigate to="/login" replace />} />
    <Route path="/projects/:projectId/*" element={user ? <Workspace /> : <Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to={user ? '/projects' : '/login'} replace />} />
  </Routes>;
}
