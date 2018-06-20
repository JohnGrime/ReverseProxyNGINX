"use strict";

const express = require( "express" );
const compression = require( "compression" );
const bodyParser = require( "body-parser" );
const helmet = require( "helmet" );

//
// Basic system configuration
//
let config = {
	port: 3000,
	compression: true,
	host_name: process.env.HOSTNAME,
};

//
// Route handlers
//
let route_handlers = {

	options: function(req,res) {
		res.setHeader( "Access-Control-Allow-Methods", "GET,OPTIONS" );
		res.end();
	},

	get: function(req,res) {
		res.setHeader( "content-type", "text/html" );
		res.end( 'Hello from ' + config.host_name );
	},

};

//
// Main script starts here.
//


//
// Basic server app setup.
//
let app = express();
{
	//
	// Handle application/json input, along with urlencoded; only
	// allow the latter to use simple values in the key/val pairs!
	// Also enable Helmet for some additional security.
	//
	app.use( bodyParser.json() );
	app.use( bodyParser.urlencoded({extended:false}) );

	app.use( helmet() );

	// Should be disabled by Helmet, but make sure!
	app.disable('x-powered-by');

	// Prevent client caching; not included in helmet?
	app.use( (req,res,next) => {
		res.setHeader( "Cache-Control", "no-cache,no-store,max-age=0,must-revalidate,proxy-revalidate" );
		res.setHeader( "Pragma", "no-cache" );
		res.setHeader( "Expires", "-1" );

		next();
	});

	//
	// Enable compression. May remove some pressure on internal networks, external
	// traffic assumed to be compressed as standard by any reverse proxy setup.
	//
	if( config["compression"] !== undefined && config["compression"] === true ) {
		console.log( "Using compression." );
		app.use( compression() );
	}

	//
	// Debug! Print some information about incoming connections.
	//
	app.use( (req,res,next) => {
		
		// Return string description for connection information
		function getConnectionInfo( connection ) {
			let { port, family, address } = connection.address();
			return `${address}:${port} < ${connection.remoteAddress} [${family}]`;
		};

		console.log( "" );
		console.log( "Incoming ", req.method, ":", req.originalUrl, getConnectionInfo(req.connection) );
		console.log( "-Headers:", req.headers );
		console.log( "-Body:", req.body );

		next();
	});
}

//
// Routing
//

{
	//
	// OPTIONS
	//

	app.options( "/*", route_handlers.options );

	//
	// GET: retrieve existing data
	//

	// Default
//	app.get( "/", route_handlers.get );
	app.get( "*", route_handlers.get );
}

//
// Launch server
//

let server = app.listen( config.port, function() {
	const {addr,port} = server.address();
	console.log( "Server: http://[%s]:[%s]", addr, port );
	console.log( 'Host name: ' + config.host_name );
});

//
// Handle some signals more gracefully, in case we're e.g. running
// in a Docker container as pid 1
//
{
	let signal_handler = function( signal ) {
		console.log( 'Server received signal: ' + signal );
		process.exit( -1 );
	};

	process.on( 'SIGINT',  signal_handler );
	process.on( 'SIGTERM', signal_handler );
}
