import React, { useState } from 'react';
import { 
  FaPlay, 
  FaCheckCircle, 
  FaClock, 
  FaExclamationTriangle, 
  FaEye, 
  FaDesktop, 
  FaWindowMinimize, 
  FaBan, 
  FaFilter,
  FaSearch
} from 'react-icons/fa';

/**
 * StudentSessionTimeline Component
 * Displays a verified, chronological activity timeline for an individual examination session.
 */
const StudentSessionTimeline = ({ attempt, logs = [], flags = [] }) => {
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!attempt) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>
        Select a student examination session to view its chronological timeline.
      </div>
    );
  }

  // Combine logs and flags into a single chronological stream
  const timelineEvents = [
    ...logs.map(log => ({
      id: log.id,
      timestamp: log.created_at || log.timestamp,
      type: log.event_type || 'SYSTEM_EVENT',
      details: log.event_details || {},
      category: 'LOG',
      severity: ['TAB_SWITCH', 'WINDOW_BLUR', 'RIGHT_CLICK'].includes(log.event_type) ? 'medium' : 'low'
    })),
    ...flags.map(flag => ({
      id: flag.id,
      timestamp: flag.timestamp || flag.created_at,
      type: flag.flag_type || 'VIOLATION_FLAG',
      details: flag.metadata || {},
      category: 'FLAG',
      severity: ['MULTIPLE_FACES_DETECTED', 'NO_FACE_DETECTED', 'SUSPICIOUS_OBJECT_DETECTED'].includes(flag.flag_type) ? 'high' : 'medium'
    }))
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Filter events
  const filteredEvents = timelineEvents.filter(ev => {
    if (filterSeverity !== 'all' && ev.severity !== filterSeverity) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const typeStr = ev.type.toLowerCase();
      const detailsStr = JSON.stringify(ev.details).toLowerCase();
      return typeStr.includes(term) || detailsStr.includes(term);
    }
    return true;
  });

  const getEventBadge = (type, severity) => {
    switch (type) {
      case 'EXAM_STARTED':
        return { icon: <FaPlay size={12} />, color: '#059669', bg: '#D1FAE5', label: 'Session Started' };
      case 'EXAM_SUBMITTED':
        return { icon: <FaCheckCircle size={12} />, color: '#059669', bg: '#D1FAE5', label: 'Exam Submitted' };
      case 'EXAM_EXPIRED':
        return { icon: <FaClock size={12} />, color: '#DC2626', bg: '#FEE2E2', label: 'Duration Expired' };
      case 'STREAM_CONNECTED':
        return { icon: <FaDesktop size={12} />, color: '#2563EB', bg: '#DBEAFE', label: 'Stream Connected' };
      case 'STREAM_DISCONNECTED':
        return { icon: <FaDesktop size={12} />, color: '#D97706', bg: '#FEF3C7', label: 'Stream Disconnected' };
      case 'TAB_SWITCH':
      case 'WINDOW_BLUR':
        return { icon: <FaWindowMinimize size={12} />, color: '#D97706', bg: '#FEF3C7', label: 'Focus Lost / Tab Switch' };
      case 'LOOKING_AWAY':
        return { icon: <FaEye size={12} />, color: '#D97706', bg: '#FEF3C7', label: 'Looking Away Alert' };
      case 'NO_FACE_DETECTED':
        return { icon: <FaBan size={12} />, color: '#DC2626', bg: '#FEE2E2', label: 'Face Not Detected' };
      case 'MULTIPLE_FACES_DETECTED':
        return { icon: <FaExclamationTriangle size={12} />, color: '#DC2626', bg: '#FEE2E2', label: 'Multiple Faces In Frame' };
      default:
        return { 
          icon: severity === 'high' ? <FaExclamationTriangle size={12} /> : <FaClock size={12} />, 
          color: severity === 'high' ? '#DC2626' : severity === 'medium' ? '#D97706' : '#4B5563', 
          bg: severity === 'high' ? '#FEE2E2' : severity === 'medium' ? '#FEF3C7' : '#F3F4F6', 
          label: type.replace(/_/g, ' ') 
        };
    }
  };

  return (
    <div className="student-session-timeline" style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
      {/* Timeline Header with Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
            Session Activity Timeline: {attempt.user_name || 'Examinee'}
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#64748B' }}>
            Verified chronological log of examination, connectivity, and proctoring events.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <FaSearch size={12} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Filter events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '6px 10px 6px 30px',
                fontSize: '0.8rem',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                outline: 'none'
              }}
            />
          </div>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#FFFFFF',
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Severities</option>
            <option value="high">High Severity Only</option>
            <option value="medium">Warnings Only</option>
            <option value="low">Standard Activity</option>
          </select>
        </div>
      </div>

      {/* Timeline Feed */}
      {filteredEvents.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94A3B8' }}>
          <FaClock size={36} style={{ display: 'block', margin: '0 auto 12px', color: '#CBD5E1' }} />
          <h4 style={{ margin: 0, color: '#475569' }}>No events recorded for this session</h4>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>Events will appear as the candidate progresses through the assessment.</p>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '28px', borderLeft: '2px solid #E2E8F0', marginLeft: '12px' }}>
          {filteredEvents.map((ev, index) => {
            const badge = getEventBadge(ev.type, ev.severity);
            const eventTime = new Date(ev.timestamp);
            const timeString = isNaN(eventTime.getTime()) 
              ? 'Unknown Time' 
              : eventTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            return (
              <div key={ev.id || index} style={{ position: 'relative', marginBottom: '24px' }}>
                {/* Node icon on vertical line */}
                <div style={{
                  position: 'absolute',
                  left: '-39px',
                  top: '2px',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: badge.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 0 0 4px #ffffff'
                }}>
                  {badge.icon}
                </div>

                {/* Event Content Box */}
                <div style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  border: '1px solid #E2E8F0'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: badge.bg,
                      color: badge.color
                    }}>
                      {badge.label}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                      {timeString}
                    </span>
                  </div>

                  {ev.details && Object.keys(ev.details).length > 0 && (
                    <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: '4px' }}>
                      {ev.details.message && <p style={{ margin: '2px 0' }}>{ev.details.message}</p>}
                      {ev.details.direction && <p style={{ margin: '2px 0' }}>Direction: <strong>{ev.details.direction}</strong></p>}
                      {ev.details.objects && (
                        <p style={{ margin: '2px 0' }}>
                          Detected objects: {ev.details.objects.map(o => o.class).join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentSessionTimeline;

