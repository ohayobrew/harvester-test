FROM node:8.9.4

# copy from local build machine to inside the docker image
COPY . /harvester

# expose port 3000
EXPOSE 3333

# Define working directory.
WORKDIR /harvester

# NOTE: this should be used in kubernetes deployments
CMD node index
