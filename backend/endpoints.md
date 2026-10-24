endoints:**/api**



***/applications(client)***



get / 					-- Get all applications for the authenticated user

get /:id 				-- Get an application with **local\_id = id**

post /:id/submit			-- Submit an application **local\_id = id, {loan\_id, loan\_sum, loan\_interest, loan\_duration} = req.body**

get /:id/history			-- Get all the log of all the status changes of the application with **local\_id = id**





***/auth(public)***



post /register				-- Register a user **{ username, password, email, inn, companyName } = req.body**

post /login				-- Login a user **{ username, password } = req.body**





***/bank(employee)***



get /applications 			-- List all the applications
get /applications/:applId 		-- Get the application with global\_id = applId

post /applications/:applId/decision	-- Decide on the application with global\_id = applID, null by default **{type, approvedAmount, approvedTermMonths, approvedRate,missingFields, reason, comment} = req.body**





***/client***



get /dashboard				-- Returns json({ userInfo, applications, latestApplicationsLog, recommendations })

get /recommendations			-- Returns recommended loans for a given user, using ML ***(todo: IMPLEMENT ML RECOMMENDATIONS!!!!)***



/***products***



get /					-- Returns list of all products(loans)





**/health**	

&#x09;			
get / 					-- Returns the state of the server



