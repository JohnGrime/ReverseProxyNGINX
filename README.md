# NGINX reverse proxy example

Assume we're running a single [NGINX](https://www.nginx.com/) server instance acting as a reverse proxy for several [Node.js](https://nodejs.org/en/) "microservices". Let's place both the NGINX server and Node.js services into [Docker](https://www.docker.com/) containers (described by `Dockerfile.nginx` and `Dockerfile.node` respectively).

The NGINX instance is controlled by a configuration file that instructs NGINX to pass incoming connections on port `80` to one of a collection of upstream Node.js services listening on port `3000`:

	#
	# Simple pass through of all incoming traffic on port 80 to a group
	# of Node.js "microservices", each listening on port 3000.
	# This configuration assumes Docker containers are run using a "test_"
	# naming prefix, as happens with e.g. docker-container and "-p test".
	#
	# Note that we have 5 copies of the Node.js service; three equally
	# weighted instances, and two backup services in case the "normal"
	# services are overloaded.
	#

	upstream node_servers {
		server test_node_1:3000 weight=1;
		server test_node_2:3000 weight=1;
		server test_node_3:3000 weight=1;

		server test_node_4:3000 backup;
		server test_node_5:3000 backup;
	}

	server {
		listen 80 default_server;
		listen [::]:80 default_server;

		location / {
			proxy_pass http://node_servers;
		}
	}

To run multiple interacting Docker containers, one simple option is [Docker Compose](https://docs.docker.com/compose/). Docker Compose (command line: `docker-compose`) uses a configuration file (`docker-compose.yaml`) in [YAML](https://en.wikipedia.org/wiki/YAML) format. However, we can also use JSON, which is actually a subset of modern YAML. A simple example of such a file might be:

	{

	"version": "3",

	"services": {
	  "node": {
	    "build": { "context": ".", "dockerfile": "Dockerfile.node" }
	  },
	  "nginx": {
	    "build": { "context": ".", "dockerfile": "Dockerfile.nginx" },
	    "ports": [ "80:80" ]
	  }
	}
	
	}

**Note**: By default, `docker-compose` associates names to containers based on the current directory name. **For the following example, we'll specify this "project name" explicitly using the `-p` option**.

To (re)build the required containers:

	ReverseProxyNGINX $ docker-compose -p test build
	ReverseProxyNGINX $ 

This should generate the Docker images `test_node` and `test_nginx` (along with the `alpine` Linux image both are based on):

	ReverseProxyNGINX $ docker images
	REPOSITORY          TAG                 IMAGE ID            CREATED                  SIZE
	test_nginx          latest              b84172071718        Less than a second ago   5.52MB
	test_node           latest              eea0c896b9d8        Less than a second ago   52.8MB
	alpine              3.7                 3fd9065eaf02        5 months ago             4.15MB
	ReverseProxyNGINX $

We may now run the specified Docker containers to produce a unified system:

	ReverseProxyNGINX $ docker-compose -p test up -d --scale node=5
	Creating network "test_default" with the default driver
	Creating test_nginx_1 ... done
	Creating test_node_1  ... done
	Creating test_node_2  ... done
	Creating test_node_3  ... done
	Creating test_node_4  ... done
	Creating test_node_5  ... done
	ReverseProxyNGINX $ 

Here, we use detached mode (`-d`) and specify that five instances of the `node` service should be created (`--scale node=5`). We can also specify the `scale` information in the 

Let's take a look at the running containers:

	ReverseProxyNGINX $ docker ps
	CONTAINER ID        IMAGE               COMMAND                  CREATED             STATUS              PORTS                NAMES
	d40469c3fa3b        test_node           "node server.js"         32 seconds ago      Up About a minute   3000/tcp             test_node_2
	c68dbfb41396        test_node           "node server.js"         32 seconds ago      Up About a minute   3000/tcp             test_node_3
	18bfb382bb9f        test_node           "node server.js"         32 seconds ago      Up About a minute   3000/tcp             test_node_4
	444baf71060d        test_node           "node server.js"         32 seconds ago      Up About a minute   3000/tcp             test_node_5
	a49002a497fd        test_node           "node server.js"         32 seconds ago      Up About a minute   3000/tcp             test_node_1
	ea2b9530167d        test_nginx          "nginx -g 'daemon of…"   32 seconds ago      Up About a minute   0.0.0.0:80->80/tcp   test_nginx_1
	ReverseProxyNGINX $

If you point your browser at [localhost:80](http://localhost:80), you should see a message from the Node.js process to which NGINX passed the incoming connection. Refreshing the browser should change the message to reflect NGINX handing the connection off to someone else; by default, NGINX uses a "[round-robin](http://nginx.org/en/docs/http/load_balancing.html)" load balancing strategy.

The command `docker-compose -p test down` should take down all the Docker containers etc that were previously launched:

	ReverseProxyNGINX $ docker-compose -p test down
	Stopping test_node_3  ... done
	Stopping test_nginx_1 ... done
	Stopping test_node_2  ... done
	Stopping test_node_1  ... done
	Stopping test_node_5  ... done
	Stopping test_node_4  ... done
	Removing test_node_3  ... done
	Removing test_nginx_1 ... done
	Removing test_node_2  ... done
	Removing test_node_1  ... done
	Removing test_node_5  ... done
	Removing test_node_4  ... done
	Removing network test_default
	ReverseProxyNGINX $ 

## Notes
  - Using the `-p` option to specify the "project name" is important; remember to use it when (re)building images, starting the services, or stopping the services using `docker-compose`.
  - While you must expose the NGINX container's port(s) to handle incoming traffic (see the `docker-compose.yml` file), it is not neccessary to expose the ports on which the Node.js services are listening; Docker sets up an internal virtual network on which the containers are visible to one another (but not to the "outside world").
