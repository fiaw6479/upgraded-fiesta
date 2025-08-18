import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const DebugAuth: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('=== DEBUG AUTH START ===');
        
        // Check environment variables
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        console.log('Supabase URL:', supabaseUrl);
        console.log('Supabase Key exists:', !!supabaseKey);
        
        setDebugInfo(prev => ({
          ...prev,
          supabaseUrl,
          supabaseKeyExists: !!supabaseKey
        }));

        // Test basic connection
        const { data, error } = await supabase.auth.getSession();
        console.log('Session data:', data);
        console.log('Session error:', error);
        
        setDebugInfo(prev => ({
          ...prev,
          sessionData: data,
          sessionError: error
        }));

        // Test database connection
        const { data: testData, error: testError } = await supabase
          .from('restaurants')
          .select('count')
          .limit(1);
          
        console.log('DB test data:', testData);
        console.log('DB test error:', testError);
        
        setDebugInfo(prev => ({
          ...prev,
          dbTestData: testData,
          dbTestError: testError
        }));

        console.log('=== DEBUG AUTH END ===');
      } catch (err) {
        console.error('Debug error:', err);
        setDebugInfo(prev => ({
          ...prev,
          debugError: err
        }));
      }
    };

    checkAuth();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Debug Information</h1>
        <div className="bg-white rounded-lg p-6 shadow">
          <pre className="text-sm overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default DebugAuth;