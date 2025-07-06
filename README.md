# Check In - Employee Time Tracking System

A comprehensive employee check-in/check-out system built on the Frappe framework. This application allows employees to track their working hours through a simple web interface with support for RFID-based attendance tracking.

## Features

- **Employee Check-in/Check-out**: Simple one-click interface for time tracking
- **RFID Support**: Supports RFID tag-based attendance tracking
- **Real-time Status**: Shows current employee status (IN/OUT)
- **Working Hours Calculation**: Automatic calculation of daily working hours
- **Attendance Management**: Integrates with Frappe's attendance system
- **Employee Profiles**: Displays employee information and photos
- **Kiosk Mode**: Touch-friendly interface for standalone kiosk deployment

## System Requirements

- **Frappe Framework**: This app requires an active Frappe installation
- **Python 3.6+**: Compatible with Python 3.6 or higher
- **Modern Web Browser**: Chrome, Firefox, Safari, or Edge
- **Optional**: RFID reader hardware for contactless check-in

## Installation

### Prerequisites

Ensure you have a working Frappe/ERPNext installation. If not, follow the [Frappe installation guide](https://frappeframework.com/docs/v14/user/en/installation).

### Install the App

1. Navigate to your Frappe bench directory:
   ```bash
   cd /path/to/your/frappe-bench
   ```

2. Get the app from the repository:
   ```bash
   bench get-app https://github.com/yourusername/check_in.git
   ```

3. Install the app on your site:
   ```bash
   bench --site your-site-name install-app check_in
   ```

4. Restart your bench:
   ```bash
   bench restart
   ```

## Configuration

### Employee Setup

1. **Employee Records**: Ensure all employees have proper records in the Employee doctype
2. **Attendance Device ID**: Set the `attendance_device_id` field for each employee
3. **User Mapping**: Link each employee to a system user via the `user_id` field
4. **Employee Photos**: Upload employee photos for better identification

### System Configuration

1. **Shifts**: Configure employee shifts in the Shift Type doctype
2. **Companies**: Ensure proper company setup for attendance tracking
3. **Permissions**: Set appropriate permissions for the Check In app

## Usage

### Web Interface

#### For Employees (Desk View)
1. Log in to your Frappe site
2. A "Check In" or "Check Out" button appears in the navigation bar
3. Click the button to record your attendance
4. The system automatically tracks your working hours

#### Kiosk Mode
1. Navigate to `/timerecord` on your Frappe site
2. Use RFID tags or manual input for employee identification
3. The system displays employee information and current status
4. Touch-friendly interface for easy operation

### API Endpoints

The app provides the following REST API endpoints:

- `GET /api/method/check_in.api.get_status` - Get current employee status
- `POST /api/method/check_in.api.check_in` - Record check-in
- `POST /api/method/check_in.api.check_out` - Record check-out

### RFID Integration

The system supports RFID-based attendance tracking:

1. Configure RFID reader hardware
2. Set `attendance_device_id` for each employee to match their RFID tag
3. The kiosk interface automatically detects and processes RFID inputs

### Key Features Implementation

#### Working Hours Calculation
- Supports "Every Valid Check-in and Check-out" method
- Automatically pairs check-in and check-out records
- Calculates total working hours for each day

#### Attendance Integration
- Creates attendance records automatically
- Links check-in/check-out records to attendance
- Updates employee online status

#### Status Management
- Tracks employee status (IN/OUT)
- Prevents duplicate check-ins/check-outs
- Maintains session-based tracking

## Troubleshooting

### Common Issues
1. **Button not appearing**: Check user permissions and employee record setup
2. **RFID not working**: Verify hardware connection and device ID configuration


## Support

For support and questions:

- **Issues**: Create an issue on the repository
- **Documentation**: Check the Frappe documentation for framework-specific questions

## Changelog

### Version 0.0.1
- Initial release
- Basic check-in/check-out functionality
- RFID support
- Working hours calculation
- Kiosk mode interface

## License

MIT License - see LICENSE file for details

## Author

**Alimerdan**  
alimerdanrahimov@gmail.com

---

*This application is built on the Frappe Framework and integrates seamlessly with ERPNext for comprehensive HR management.*
