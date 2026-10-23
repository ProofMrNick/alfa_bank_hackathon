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







***/client***



get /dashboard				-- Returns json({ userInfo, applications, latestApplicationsLog, recommendations })



/***products***



get /					-- Returns list of all products(loans)



