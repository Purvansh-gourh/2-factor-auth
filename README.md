"# 2-factor-auth" 
--------------------------------------------------------------<br/>
A project demonstrating the 2 factor authentication process<br/>
for login system.
## Following factors are used for authentication :
1. Username and password as first verification step.
2. OTP based verification.
<br/>
API used : twilio (to send OTP to registered mobile number)

## functionalities
1. Username password authentication
2. OTP based verification
3. Reset password by link sent to email on forgot password
4. Change password from dashboard.
5. Edit user details
6. Mobile number verification status
7. Option to switch ON or OFF OTP verification.

  
## Installations required
1. Node.js (https://nodejs.org/en/download/)
2. mongoDB (https://www.mongodb.com/download-center/community?tck=docs_server)
3. npm (inside node.js to install packages)<br/>
(installation guide : https://www.guru99.com/download-install-node-js.html)
    
4. using npm install necessary packages mentioned in package.json or run : npm install
5. Setup other requirements
   i. gmail account : to send mail as admin when user click forgot password<br/>
    (Replace details in configure.js in configure directory with gmail details)
   ii. twilio account : to send message using their API to send OTP<br/>
    (After creating twilio account purchase a number using free credits available.<br/>
     Then copy paste accountSID, serviceID,phone and authToken in configure.js)<br/>
    (Note : If you are using twilio trial account so numbers we send OTP to must<br/>
            be verified in console at twilio account dashboard.)

## Running the app
- node app.js

### Configure file settings
create a configure.js file in configure directory with following structure
<pre>
module.exports = {
    twilio: {
        serviceID: 'your serviceID here',
        accountSID: 'your accountSID here',
        authToken: 'your authToken here',
    },
    adminmail: {
        service: 'service provider eg:gmail',
        auth: {
            user: 'your username here',
            pass: 'your password here'
        }
    }
}
</pre>