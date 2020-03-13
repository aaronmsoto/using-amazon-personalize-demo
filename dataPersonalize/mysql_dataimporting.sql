--Table: users
create table users ( user_id int, age int, gender varchar(1), occupation varchar(128), zip5 varchar(5) );
LOAD DATA LOCAL INFILE 'u.user' INTO TABLE users FIELDS TERMINATED BY '|' LINES TERMINATED BY '\n';

--Table: movies
create table movies ( movie_id int, movie_title varchar(128), release_date varchar(16), video_release_date varchar(16), IMDB_url varchar(256), unknown int, Action int, Adventure int, Animation int, Childrens int, Comedy int, Crime int, Documentary int, Drama int, Fantasy int, FilmNoir int, Horror int, Musical int, Mystery int, Romance int, SciFi int, Thriller int, War int, Western int );
LOAD DATA LOCAL INFILE 'u.item' INTO TABLE movies FIELDS TERMINATED BY '|' LINES TERMINATED BY '\n';

--Table: interactions
create table users_x_movies ( user_id int, movie_id int, rating_stars int, rating_timestamp long );
LOAD DATA LOCAL INFILE 'u.data' INTO TABLE users_x_movies FIELDS TERMINATED BY '\t' LINES TERMINATED BY '\n';

