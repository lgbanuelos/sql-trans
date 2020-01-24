CREATE OR REPLACE FUNCTION aggr_count(pname TEXT) RETURNS TABLE(cnt
INT8) AS
$$
     SELECT COUNT(ship_2.ship_id) AS cnt
     FROM ship_2, port_2, parameters
     WHERE port_2.name = pname AND (ABS(ship_2.latitude -
port_2.latitude) + ABS(ship_2.longitude - port_2.longitude)) ^ 0.5 /
ship_2.max_speed <= parameters.deadline
$$
language SQL IMMUTABLE returns NULL on NULL INPUT;

SELECT p.name AS name, res.cnt AS cnt INTO aggr_count_2 FROM port_2 AS
p, aggr_count(p.name) AS res;

SELECT ac2.name AS name, ac2.cnt AS cnt INTO aggr_count_1 FROM
aggr_count_2 AS ac2;

CREATE OR REPLACE FUNCTION slots_count(pname TEXT) RETURNS
TABLE(slots_number INT8) AS $$ SELECT COUNT(slot.slot_id) AS
slots_number FROM port_1, aggr_count_1, slot, berth, parameters WHERE
aggr_count_1.name = port_1.name AND port_1.name = pname AND
port_1.port_id = berth.port_id AND slot.port_id = berth.port_id AND
slot.berth_id = berth.berth_id AND slot.slotstart <= parameters.deadline
AND slot.slotstart + port_1.offloadtime <= slot.slotend $$ language SQL
IMMUTABLE returns NULL on NULL INPUT;

SELECT p.name AS portname, res.slots_number AS slots_number INTO
capacities_1 FROM port_1 AS p, slots_count(p.name) AS res;
