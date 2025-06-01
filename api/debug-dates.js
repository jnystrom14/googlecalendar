// Debug date calculation for rollover
export default async function handler(req, res) {
  try {
    const now = new Date();
    console.log('Current time:', now.toISOString());
    
    // Tomorrow calculation from manual-rollover
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfDay = new Date(tomorrow);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(tomorrow);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log('Manual rollover tomorrow range:');
    console.log('Start:', startOfDay.toISOString());
    console.log('End:', endOfDay.toISOString());
    
    // Debug calculation (from debug endpoint)
    const debugTomorrow = new Date();
    debugTomorrow.setDate(debugTomorrow.getDate() + 1);
    const debugStartOfDay = new Date(debugTomorrow);
    debugStartOfDay.setHours(0, 0, 0, 0);
    const debugEndOfDay = new Date(debugTomorrow);
    debugEndOfDay.setHours(23, 59, 59, 999);
    
    console.log('Debug endpoint tomorrow range:');
    console.log('Start:', debugStartOfDay.toISOString());
    console.log('End:', debugEndOfDay.toISOString());
    
    return res.status(200).json({
      success: true,
      current: now.toISOString(),
      manualRollover: {
        start: startOfDay.toISOString(),
        end: endOfDay.toISOString(),
        dateString: startOfDay.toDateString()
      },
      debugEndpoint: {
        start: debugStartOfDay.toISOString(),
        end: debugEndOfDay.toISOString(),
        dateString: debugStartOfDay.toDateString()
      },
      sampleEvents: [
        { id: "event1", start: "2025-06-01", summary: "Today event" },
        { id: "event2", start: "2025-06-02", summary: "Tomorrow event" }
      ]
    });
    
  } catch (error) {
    return res.status(200).json({
      success: false,
      error: error.message
    });
  }
}