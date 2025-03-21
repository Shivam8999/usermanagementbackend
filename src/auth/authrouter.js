const express = require("express");
// const open = require("open") //this type of import is returning error as we are in commonjs
const {OAuth2Client}= require('google-auth-library')
const {google} = require('googleapis');
const url = require("url")

const router = express.Router();

require('dotenv').config();

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI } = process.env;

// const oAuth2Client = new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI); //this sets up the oAuth2Client for google

const oAuth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI); //this sets up the oAuth2Client for google


const AUTH_URL = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/drive'],
    include_granted_scopes: true,
    prompt:'consent',
});

router.get('/auth/app/google/login',async (req,res)=>{ //if user accessing this api from apps rather than API //for app accessing
    const open = (await import("open")).default;
    open(AUTH_URL, { wait: false }); // Opens the URL without waiting for the browser to close
})

router.get('/auth/site/google/login', (req, res) => { //if user is accessing this api from a website //for broser accessing
    
    res.redirect(AUTH_URL);
});


router.get('/auth/callback', async (req, res) => {
    // const code = req.query.code;
    // if (!code) return res.status(400).json({ error: 'No auth code provided' });

    // try {
    //     const { tokens } = await oAuth2Client.getToken(code);
    //     oAuth2Client.setCredentials(tokens);

    //     const userInfo = await oAuth2Client.request({ url: 'https://www.googleapis.com/oauth2/v2/userinfo' });

    //     res.json({ user: userInfo.data, tokens });
    // } catch (error) {
    //     res.status(500).json({ error: 'Token exchange failed', details: error.message });
    // }

    
    let q = url.parse(req.url, true).query;
    
    console.log("call backs received")
    if (q.error) { // An error response e.g. error=access_denied
        console.log('Error:' + q.error);
    } 
    // else if (q.state !== req.session.state) { //check state value
    //     console.log('State mismatch. Possible CSRF attack');
    //     res.end('State mismatch. Possible CSRF attack');
    // } 
    else { // Get access and refresh tokens (if access_type is offline)
        
    }

    

    try {
        let resDetails = await oAuth2Client.getToken(q.code);
        oAuth2Client.setCredentials(resDetails.tokens);

        const oauth2 = google.oauth2({ version: "v2", auth: oAuth2Client });
        const userinfodata = await oauth2.userinfo.get();

        console.log(resDetails.tokens)
        res.status(200).json({msg:"Successfully authorised the client"})
    } catch (error) {
        res.status(500).json({msg:"Error occured in getting authorization"})
    }

    

});



// router.get

module.exports = router;