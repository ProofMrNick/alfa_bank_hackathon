endoints:**/api**



***/applications(client)***



get / 					-- Get all applications for the authenticated user

get /:id 				-- Get an application with **local\_id = id**

post /:id/submit			-- Submit an application **local\_id = id, {loan\_id, loan\_sum, loan\_interest, loan\_duration} = req.body**

get /:id/history			-- Get all the log of all the status changes of the application with **local\_id = id**

post /:id/clarify			-- Fills in missing fields in FNS, BKI, internal\_registry **{ bki\_data = {}, fns\_data = {}, internal\_data = {} } = req.body (e.g. fns\_data = {"ogrn": "example\_ogrn"}),** only works if field is null, then sets status of the application to "PENDING", puts bki\_data, fns\_data, internal\_data and list of updated fields in comment field of application\_log

post /:id/acceptOffer			-- User accepts the application with local\_id = id

***/auth(public)***



post /register				-- Register a user **{ username, password, email, inn, companyName } = req.body,** returns in the response token, role, use\_info

post /login				-- Login a user **{ username, password } = req.body,** and rescore risk\_score of the user if the last  rescoring was more than a week ago, returns in the response token, role, use\_info





***/bank(employee)***



get /applications 			-- List all the applications
get /applications/:applId 		-- Get the application with global\_id = applId

post /applications/:applId/decision	-- Decide on the application with global\_id = applID, null by default **{type, approvedAmount, approvedTermMonths, approvedRate,missingFields, reason, comment} = req.body**

get applications/:applId/history	-- Get all the logs for a given application with **global\_id = applID**

get clients/:inn			-- Get all the info for a given user {user\_info, bki, fns, internal, risk\_score\_history}



***/client/***



get /dashboard				-- Returns json({ userInfo, applications, latestApplicationsLog, recommendations })

get /recommendations			-- Returns recommended loans for a given user, and loan parameters using ML ***(todo: IMPLEMENT ML RECOMMENDATIONS!!!!)***



/***products***



get /					-- Returns list of all products(loans)





**/health**

&#x09;
get / 					-- Returns the state of the server

