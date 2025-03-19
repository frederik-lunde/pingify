export function getStatusColor(uptime: number): 'success' | 'warning' | 'error' | 'default' {
    if (uptime > 99) return 'success';
    if (uptime > 95) return 'warning';
    return 'error';
  }
  
  export function getResponseTimeColor(time: number): 'success' | 'warning' | 'error' | 'default' {
    if (time < 300) return 'success';
    if (time < 1000) return 'warning';
    return 'error';
  }
  
  export function getAlertTypeColor(type: string): 'success' | 'warning' | 'error' | 'info' {
    switch (type.toLowerCase()) {
      case 'down':
        return 'error';
      case 'recovered':
        return 'success';
      case 'slow':
        return 'warning';
      default:
        return 'info';
    }
  }