import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { login as apiLogin, startMicrosoftOAuthLogin } from '../../../shared/api/authApi';
import { useAuth } from '../../../context/AuthContext';

export const SocialProviders = ({ onMicrosoftLogin }) => (
  <div className="flex flex-col gap-4">
    <button
      className="flex items-center justify-center gap-3 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      onClick={onMicrosoftLogin}
      type="button"
    >
      <svg className="w-5 h-5" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 1h10v10H1z" fill="#f35325" />
        <path d="M12 1h10v10H12z" fill="#81bc06" />
        <path d="M1 12h10v10H1z" fill="#05a6f0" />
        <path d="M12 12h10v10H12z" fill="#ffba08" />
      </svg>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Outlook</span>
    </button>
  </div>
);

export default function AuthFormBlock() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { login: contextLogin } = useAuth();

  const handleMicrosoftLogin = () => {
    startMicrosoftOAuthLogin();
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errorParam = params.get('error');
    if (!errorParam) {
      return;
    }

    if (errorParam === 'SessionExpired') {
      setError('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
      return;
    }

    setError(decodeURIComponent(errorParam));
  }, [location.search]);

  const handleStandardLogin = async (e) => {
    e.preventDefault();

    setError(null);
    setLoading(true);

    try {
      // 1. Lấy tokens từ /login
      const tokenData = await apiLogin({ username, password });

      // Goi /me bang header Bearer truc tiep de lay thong tin user sau login.
      const meResponse = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${tokenData.accessToken}` },
      });

      if (!meResponse.ok) {
        throw new Error('Không thể lấy thông tin người dùng.');
      }

      const userPayload = await meResponse.json();

      // 2. Cập nhật AuthContext với đầy đủ thông tin (tokens + user)
      contextLogin({
        ...userPayload,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        deviceToken: tokenData.deviceToken,
      });

      // 3. Redirect — HomeRedirect sẽ điều hướng theo role
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] bg-white dark:bg-slate-900 shadow-xl rounded-2xl p-8 border border-primary/5">
      <div className="text-center mb-8">
        <h1 className="text-slate-900 dark:text-slate-100 text-3xl font-bold leading-tight mb-2">Chào mừng trở lại</h1>
        <p className="text-slate-500 dark:text-slate-400 text-base font-normal">Tiếp tục hành trình tri thức cùng UniPoint</p>
      </div>

      {error && (
        <div className="mb-5 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <form className="space-y-5" onSubmit={handleStandardLogin}>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tên đăng nhập</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">person</span>
            <input
              className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-900 dark:text-white"
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập"
              required
              type="text"
              value={username}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Mật khẩu</label>
            <a className="text-xs text-[#d23232] dark:text-[#d23232]/80 font-medium hover:underline" href="#">
              Quên mật khẩu?
            </a>
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">lock</span>
            <input
              className="w-full pl-12 pr-12 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-slate-900 dark:text-white"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              type={showPassword ? 'text' : 'password'}
              value={password}
            />
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
              onClick={() => setShowPassword((prev) => !prev)}
              type="button"
            >
              <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
        </div>

        <button
          className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
          disabled={loading}
          type="submit"
        >
          <span>{loading ? 'Đang đăng nhập...' : 'Đăng nhập ngay'}</span>
          <span className="material-symbols-outlined text-xl">arrow_forward</span>
        </button>
      </form>

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white dark:bg-slate-900 text-slate-500">Hoặc tiếp tục với</span>
        </div>
      </div>

      <SocialProviders onMicrosoftLogin={handleMicrosoftLogin} />

      <p className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
        Bằng việc tiếp tục, bạn đồng ý với{' '}
        <a className="underline hover:text-[#d23232]" href="#">
          Điều khoản dịch vụ
        </a>{' '}
        và{' '}
        <a className="underline hover:text-[#d23232]" href="#">
          Chính sách bảo mật
        </a>{' '}
        của UniPoint.
      </p>
    </div>
  );
}
