import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Phone, Clock, MapPin, Tag } from 'lucide-react';
import { CustomerProfile, Call } from '@/types/call-center';

interface CustomerInfoPanelProps {
  customerProfile: CustomerProfile | null;
  activeCall: Call | null;
}

export const CustomerInfoPanel = ({ customerProfile, activeCall }: CustomerInfoPanelProps) => {
  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Customer Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!customerProfile && !activeCall ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <p>No active call</p>
          </div>
        ) : (
          <>
            {/* Basic Call Info */}
            {activeCall && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{activeCall.customer_number}</span>
                  <Badge variant={activeCall.call_status === 'in-progress' ? 'default' : 'secondary'}>
                    {activeCall.call_status || 'active'}
                  </Badge>
                </div>
                
                {activeCall.call_direction && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Direction:</span>
                    <Badge variant="outline">{activeCall.call_direction}</Badge>
                  </div>
                )}

                {(activeCall.caller_city || activeCall.caller_state || activeCall.caller_country) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {[activeCall.caller_city, activeCall.caller_state, activeCall.caller_country]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Customer Profile Info */}
            {customerProfile && (
              <>
                <hr className="my-4" />
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                    Customer Profile
                  </h3>
                  
                  {customerProfile.name && (
                    <div>
                      <span className="font-medium">{customerProfile.name}</span>
                    </div>
                  )}

                  {customerProfile.email && (
                    <div className="text-sm text-muted-foreground">
                      {customerProfile.email}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {customerProfile.call_history_count} previous calls
                    </span>
                  </div>

                  {customerProfile.last_interaction_at && (
                    <div className="text-sm text-muted-foreground">
                      Last contact: {new Date(customerProfile.last_interaction_at).toLocaleDateString()}
                    </div>
                  )}

                  {customerProfile.preferred_language && customerProfile.preferred_language !== 'en' && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Language:</span>
                      <Badge variant="outline">{customerProfile.preferred_language}</Badge>
                    </div>
                  )}

                  {customerProfile.tags && customerProfile.tags.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Tags:</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {customerProfile.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {customerProfile.customer_notes && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-muted-foreground">Notes:</span>
                      <div className="p-3 bg-muted rounded-lg text-sm">
                        {customerProfile.customer_notes}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};