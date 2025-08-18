import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();

  // Check for success message from signup
  const successMessage = location.state?.message;
  const prefilledEmail = location.state?.email;

  React.useEffect(() => {
    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }
  }, [prefilledEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
   <div className="min-h-screen bg-gradient-to-br from-white via-gray-100 to-gray-200 flex items-center justify-center p-4">
  <div className="max-w-md w-full space-y-8">
    {successMessage && (
      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm text-center">
        {successMessage}
      </div>
    )}
    
    <div className="text-center">
      <img
        src="/image.png"
        alt="VOYA"
        className="mx-auto h-16 w-auto mb-4"
      />
      <h2 className="text-3xl font-bold text-gray-900 font-['Space_Grotesk']">
        Welcome to VOYA
      </h2>
      <p className="mt-2 text-gray-600">
        Sign in to your restaurant dashboard
      </p>
    </div>

    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
            placeholder="Enter your email"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E6A85C] focus:border-transparent"
            placeholder="Enter your password"
          />
        </div>
      </div>

      {error && (
        <div className="text-red-600 text-sm text-center bg-red-100 p-3 rounded-lg">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg text-white font-medium bg-gradient-to-r from-[#E6A85C] via-[#E85A9B] to-[#D946EF] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#E6A85C] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        {isLoading ? 'Signing in...' : 'Sign in'}
      </button>
      
      <div className="text-center mt-4">
        <Link 
          to="/signup" 
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Don't have an account? Sign up for free
        </Link>
      </div>
    </form>
  </div>
</div>

  );
};

export default LoginPage;