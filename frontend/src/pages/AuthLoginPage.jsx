import React from 'react';
import AuthFormBlock from '../features/auth/components/AuthFormBlock';

const LoginHeader = () => (
  <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-primary/10 px-6 md:px-20 py-4 bg-white dark:bg-slate-900">
    <div className="flex items-center gap-3 text-primary dark:text-slate-100">
      <div className="size-8 bg-white rounded-lg flex items-center justify-center overflow-hidden border border-primary/10">
        <img src="/logo.png" alt="Logo" className="h-full w-full object-cover" />
      </div>
      <h2 className="text-xl font-bold leading-tight tracking-[-0.015em]">Điểm rèn luyện</h2>
    </div>
    <div className="flex gap-4">
      <button className="hidden md:flex min-w-[84px] cursor-pointer items-center justify-center rounded-lg h-10 px-4 border border-primary/20 text-primary dark:text-slate-100 text-sm font-bold" type="button">
        <span>Trợ giúp</span>
      </button>
      <button className="flex min-w-[84px] cursor-pointer items-center justify-center rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold" type="button">
        <span>Liên hệ</span>
      </button>
    </div>
  </header>
);

const AuthLoginPage = () => {
  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 min-h-screen flex flex-col">
      <div className="relative flex h-auto min-h-screen w-full flex-col group/design-root overflow-x-hidden">
        <div className="layout-container flex h-full grow flex-col">
          <LoginHeader />

          <main className="flex-1 flex items-center justify-center p-6 bg-slate-50 dark:bg-background-dark">
            <AuthFormBlock />
          </main>

          <footer className="py-6 text-center text-slate-400 dark:text-slate-500 text-sm">© 2024 Điểm rèn luyện Ecosystem. All rights reserved.</footer>
        </div>
      </div>
    </div>
  );
};

export default AuthLoginPage;
