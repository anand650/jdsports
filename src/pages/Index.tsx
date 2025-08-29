import { CallCenterLayout } from '@/components/CallCenterLayout';
import { TranscriptionTest } from '@/components/TranscriptionTest';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const Index = () => {
  const [showTest, setShowTest] = useState(false);

  return (
    <div className="h-screen">
      {!showTest ? (
        <>
          <div className="absolute top-4 right-4 z-50">
            <Button 
              onClick={() => setShowTest(true)}
              variant="outline"
            >
              Test Transcription
            </Button>
          </div>
          <CallCenterLayout />
        </>
      ) : (
        <>
          <div className="absolute top-4 right-4 z-50">
            <Button 
              onClick={() => setShowTest(false)}
              variant="outline"
            >
              Back to Dashboard
            </Button>
          </div>
          <TranscriptionTest />
        </>
      )}
    </div>
  );
};

export default Index;
